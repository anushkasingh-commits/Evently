function parseNaturalLanguage(text='') {
  const t = text.toLowerCase();
  const capacity = +(t.match(/(?:for|capacity|fit|seat)\s*(?:up to\s*)?(\d+)\s*(?:people|persons|attendees|seats)?/)?.[1] || t.match(/(\d+)\s*(?:people|persons|attendees|seats)/)?.[1] || 0);
  const facilities = ['projector','ac','wi-fi','wifi','stage','sound system','microphones','parking','smart board','tables','chairs','lighting'].filter(f => t.includes(f));
  const time = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  let startTime='', endTime='';
  if (time) {
    const to24=(h,m,ampm)=>{h=+h;m=+(m||0);if(ampm==='pm'&&h<12)h+=12;if(ampm==='am'&&h===12)h=0;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`};
    startTime=to24(time[1],time[2],time[3]); endTime=to24(time[4],time[5],time[6]||time[3]);
  }
  const rate = +(t.match(/(?:under|below|budget|less than)\s*₹?\s*(\d+)/)?.[1] || 0);
  return { capacity, facilities: facilities.map(x => x==='wifi'?'Wi-Fi':x.split(' ').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ')), startTime, endTime, maxRate: rate };
}
module.exports = parseNaturalLanguage;
