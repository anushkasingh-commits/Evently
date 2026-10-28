// Shows the standard error page with the given status code
function fail(res, status, title, message) {
  return res.status(status).render('errors/error', { title, message });
}

module.exports = { fail };
