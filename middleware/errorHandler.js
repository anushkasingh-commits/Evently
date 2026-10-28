// Last-resort error handler. Every route passes unexpected errors here,
// so the server keeps running and the user sees a friendly page.
module.exports = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // Log the full error on the server so it can be fixed
  console.error(err);

  // Bad ids, dates or numbers that reach the database are the user's mistake, not a server crash
  let status = err.status || 500;
  if (err.name === 'CastError' || err.name === 'ValidationError') {
    status = 400;
  } else if (err.code === 11000) {
    status = 409;
  }

  let message = 'Something went wrong. Please try again.';
  if (status === 400) {
    message = 'Some of the information you entered is not valid. Please check it and try again.';
  } else if (status === 409) {
    message = 'That information already exists. Please use something different.';
  } else if (status < 500 && err.message) {
    message = err.message;
  }

  // In development, show the real error message to help debugging
  if (process.env.NODE_ENV === 'development' && status >= 500) {
    message = err.message;
  }

  if (req.accepts('html')) {
    return res.status(status).render('errors/error', { title: 'Something went wrong', message });
  }
  res.status(status).json({ error: message });
};
