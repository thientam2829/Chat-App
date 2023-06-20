var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

var Member = require('../models/member');

// check logged
exports.isLoggedIn = function(req, res, next) {
    if (req.session.user) {
        return next();
    } else {
        res.redirect('/login');
    }
};
// check not logged
exports.notLoggedIn = function(req, res, next) {
    if (!req.session.user) {
        return next();
    } else {
        res.redirect('/login');
    }
};
