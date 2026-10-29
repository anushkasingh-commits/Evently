// Voice broker for Evently
// The broker asks the organiser a few questions, reads out the best venues
// and their prices, then sends a booking request only after "confirm".

const micButton = document.getElementById('mic-button');
const messageBox = document.getElementById('broker-messages');

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// The questions to ask, in order. "field" is the name we save the answer under.
const questions = [
  { field: 'eventName', ask: 'What is the name of your event?' },
  { field: 'headcount', ask: 'How many people are coming? Please say a number.' },
  { field: 'date', ask: 'What date do you need the venue? For example, November 2.' },
  { field: 'startHour', ask: 'What hour does it start? Use 24-hour time. For example, say 18 for 6 PM.' },
  { field: 'hours', ask: 'How many hours do you need it for?' },
  { field: 'budget', ask: 'What is your maximum budget per hour, in rupees? Please say a number.' }
];

let stage = 'idle'; // idle, asking, choosing, confirming or done
let step = 0;
let booking = {};
let shown = []; // the venues read out, in order
let chosen = null;

const recognition = SpeechRecognition ? new SpeechRecognition() : null;

// Show a message on the page and speak it aloud, then run the next step
function say(text, next) {
  messageBox.textContent = text;
  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = 'en-IN';
  speech.onend = function () {
    if (next) {
      next();
    }
  };
  window.speechSynthesis.speak(speech);
}

// Start listening, ignoring the error if it is already listening
function listen() {
  try {
    recognition.start();
  } catch (error) {
    // Already listening, so nothing to do
  }
}

// Turns "2", "two" or "two people" into a number. Returns null if it can't.
function numberFrom(heard) {
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const digits = heard.replace(/\D/g, '');
  if (digits !== '') {
    return parseInt(digits, 10);
  }
  const firstWord = heard.trim().split(' ')[0];
  return words[firstWord] || null;
}

// Turns "november 2" into "2026-11-02" (the format the server expects)
// If that date has already passed this year, the next occurrence (next year) is used.
function toIsoDate(heard) {
  // The date must name a month, otherwise the browser guesses (for example, January 1)
  const hasMonth = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/.test(heard);
  if (!hasMonth) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let parsed = new Date(heard + ' ' + today.getFullYear());
  if (isNaN(parsed.getTime())) {
    return null;
  }
  if (parsed < today) {
    parsed = new Date(heard + ' ' + (today.getFullYear() + 1));
  }

  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return parsed.getFullYear() + '-' + month + '-' + day;
}
// Pads a number to two digits, for example 6 becomes "06"
function twoDigits(number) {
  return String(number).padStart(2, '0');
}

// Saves one answer. Returns false if the answer is not valid.
function saveAnswer(field, heard) {
  if (field === 'eventName') {
    booking.eventName = heard.slice(0, 120);
    return true;
  }

  if (field === 'date') {
    const isoDate = toIsoDate(heard);
    if (!isoDate) {
      return false;
    }
    booking.date = isoDate;
    return true;
  }

  const number = numberFrom(heard);
  if (number === null) {
    return false;
  }

  if (field === 'startHour' && (number < 0 || number > 23)) {
    return false;
  }

  if (field === 'hours') {
    const startHour = booking.startHour || 0;
    if (number < 1 || startHour + number > 23) {
      return false;
    }
  }

  booking[field] = number;
  return true;
}

// Ask the next question, or search once every answer is saved
function askNext() {
  if (step < questions.length) {
    say(questions[step].ask, listen);
  } else {
    findVenues();
  }
}

// Start over from the first question
function startConversation() {
  stage = 'asking';
  step = 0;
  booking = {};
  shown = [];
  chosen = null;
  askNext();
}

// Ask the server for venues that fit, then read the top three with prices
async function findVenues() {
  say('Let me find venues for you.');

  const startTime = twoDigits(booking.startHour) + ':00';
  const endTime = twoDigits(booking.startHour + booking.hours) + ':00';
  const params = new URLSearchParams({
    capacity: booking.headcount,
    maxRate: booking.budget,
    date: booking.date,
    startTime: startTime,
    endTime: endTime
  });

  try {
    const response = await fetch('/api/venues?' + params.toString());
    const venues = await response.json();

    if (venues.length === 0) {
      say('Sorry, no venues match those details. Let us start again.', startConversation);
      return;
    }

    shown = venues;
    stage = 'choosing';

    let text = 'I found ' + shown.length + ' options. ';
    for (let i = 0; i < shown.length; i++) {
      const total = Math.round(shown[i].hourlyRate * booking.hours);
      text = text + 'Option ' + (i + 1) + ' is ' + shown[i].name + ', ' + total + ' rupees in total. ';
    }
    text = text + 'Which option do you want? Say the number.';
    say(text, listen);
  } catch (error) {
    say('Sorry, I could not search for venues. Please try again.');
    stage = 'idle';
  }
}

// Handles an answer to one of the questions
function answerQuestion(heard) {
  const field = questions[step].field;

  if (!saveAnswer(field, heard)) {
    say('Sorry, I did not catch that. ' + questions[step].ask, listen);
    return;
  }

  step = step + 1;
  askNext();
}

// The organiser picked option 1, 2 or 3
function chooseVenue(heard) {
  const number = numberFrom(heard);
  if (number === null || number < 1 || number > shown.length) {
    say('Please say option 1, 2 or 3.', listen);
    return;
  }

  chosen = shown[number - 1];
  stage = 'confirming';
  const total = Math.round(chosen.hourlyRate * booking.hours);
  say(
    'You chose ' + chosen.name + ', ' + total + ' rupees for ' + booking.hours + ' hours. Say confirm to send the request, or say cancel.',
    listen
  );
}

// Sends the booking request only after a clear "confirm"
// Sends the booking request only after a clear "confirm"
function confirmBooking(heard) {
  if (stage === 'sending') {
    return; // Already sending, so ignore any extra speech
  }

  if (heard.includes('cancel')) {
    stage = 'done';
    say('Okay, nothing was booked. Press the button to start again.');
    return;
  }

  if (!heard.includes('confirm')) {
    say('Please say confirm, or say cancel.', listen);
    return;
  }

  // Lock first: any further speech is ignored until this request finishes
  stage = 'sending';

  const startTime = twoDigits(booking.startHour) + ':00';
  const endTime = twoDigits(booking.startHour + booking.hours) + ':00';

  // The existing booking form expects form data, not JSON
  const body = new URLSearchParams({
    venueId: chosen._id,
    eventName: booking.eventName,
    eventType: 'Other',
    attendees: booking.headcount,
    date: booking.date,
    startTime: startTime,
    endTime: endTime
  });

  say('Sending your request.');

  fetch('/bookings', {
    method: 'POST',
    body: body,
    headers: { Accept: 'application/json' }
  })
    .then(async function (response) {
      stage = 'done';

      // If the server sent us to the sign-in page, the user is not logged in
      if (response.url.includes('/login')) {
        say('Please sign in first, then try again.');
        return;
      }

      if (response.ok) {
        say('Your booking request has been sent. The venue will approve it soon.');
        return;
      }

      // Read the reason the server gave, for example "Booking date cannot be in the past."
      let reason = 'Please check the details and try again.';
      try {
        const data = await response.json();
        if (data.error) {
          reason = data.error;
        }
      } catch (error) {
        // Not JSON, so keep the general reason
      }
      say('Sorry, the request was not sent. ' + reason + ' Press the button to start again.');
    })
    .catch(function () {
      stage = 'done';
      say('Sorry, the request could not be sent. Please check your connection and try again.');
    });
}

if (!recognition) {
  micButton.disabled = true;
  messageBox.textContent = 'Voice is not supported in this browser. Please use Google Chrome.';
} else {
  recognition.lang = 'en-IN';

  // Press once to start. Press again to answer if the broker is not listening.
  micButton.addEventListener('click', function () {
    if (stage === 'sending') {
      return; // A request is already being sent, so ignore the button
    }
    if (stage === 'idle' || stage === 'done') {
      startConversation();
    } else {
      listen();
    }
  });

  // Every spoken answer comes through here
  recognition.addEventListener('result', function (event) {
    const heard = event.results[0][0].transcript.trim().toLowerCase();

    if (stage === 'asking') {
      answerQuestion(heard);
    } else if (stage === 'choosing') {
      chooseVenue(heard);
    } else if (stage === 'confirming') {
      confirmBooking(heard);
    }
  });

  // If nothing was heard or the mic was blocked, tell the user
  recognition.addEventListener('error', function (event) {
    if (event.error === 'not-allowed') {
      messageBox.textContent = 'Microphone access is blocked. Allow it in your browser settings and try again.';
    } else {
      messageBox.textContent = 'I did not hear anything. Press the button and try again.';
    }
  });
}
