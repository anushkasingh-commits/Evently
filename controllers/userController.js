const User = require('../models/User');
const Notification = require('../models/Notification');
const { isValidId } = require('../utils/validators');
const { fail } = require('../utils/respond');

// Add or remove a venue from the signed-in user's favourites
exports.toggleFavorite = async (req, res, next) => {
  try {
    const venueId = req.params.id;
    if (!isValidId(venueId)) {
      return fail(res, 404, 'Venue not found', 'This venue does not exist.');
    }

    const user = await User.findById(req.user._id);
    const index = user.favorites.findIndex((id) => id.toString() === venueId);

    if (index >= 0) {
      user.favorites.splice(index, 1);
    } else {
      user.favorites.push(venueId);
    }
    await user.save();

    res.redirect(req.get('referer') || '/venues');
  } catch (e) {
    next(e);
  }
};

// The signed-in user's notifications, newest first
exports.notifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
    res.render('notifications', { title: 'Notifications', notifications });
  } catch (e) {
    next(e);
  }
};

// Mark all notifications as read
exports.readNotifications = async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.user._id }, { isRead: true });
    res.redirect('/notifications');
  } catch (e) {
    next(e);
  }
};
