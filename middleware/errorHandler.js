module.exports = (err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  if (req.accepts('html')) return res.status(status).render('errors/error', { title: 'Something went wrong', message: process.env.NODE_ENV === 'development' ? err.message : 'Please try again.' });
  res.status(status).json({ error: err.message || 'Internal server error' });
};
