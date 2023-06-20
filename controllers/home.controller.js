const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const fs = require("fs");
const Member = require("../models/member");

exports.index = (req, res, next) => {
  res
    .render("frontend/home/index", {
      pageTitle: "WebChat",
    })
    .catch((err) => console.log(err));
};

exports.login = (req, res, next) => {
  let messages = req.flash("error");
  if (messages.length > 0) {
    messages = messages[0];
  } else {
    messages = null;
  }
  res.render("frontend/home/login", {
    pageTitle: "WebChat/Login",
    errorMessage: messages,
  });
};

exports.postLogin = (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  Member.findOne({
    "local.email": email,
  })
    .then((user) => {
      if (!user) {
        req.flash("error", "Invalid email.");
        return res.redirect("/login");
      }
      bcrypt
        .compare(password, user.local.password)
        .then((doMatch) => {
          if (doMatch) {
            req.session.isLoggedIn = true;
            req.session.user = user;

            return req.session.save((err) => {
              if (err) console.log(err);
              req.flash(
                "messagesWelcome",
                "Hello " + user.info.firstname + " " + user.info.lastname
              );
              res.redirect("/chatapp");
            });
          }
          req.flash("error", "Invalid password.");
          res.redirect("/login");
        })
        .catch((err) => {
          console.log(err);
          res.redirect("/login");
        });
    })
    .catch((err) => console.log(err));
};

exports.getLogout = (req, res) => {
  req.session.destroy((err) => {
    console.log(err);
    res.redirect("/login");
  });
};

exports.register = (req, res, next) => {
  let messages = req.flash("error");
  if (messages.length > 0) {
    messages = messages[0];
  } else {
    messages = null;
  }
  res.render("frontend/home/register", {
    pageTitle: "WebChat/Register",
    errorMessage: messages,
  });
};

exports.register = (req, res, next) => {
  let messages = req.flash("error");
  if (messages.length > 0) {
    messages = messages[0];
  } else {
    messages = null;
  }
  res.render("frontend/home/register", {
    pageTitle: "WebChat/Register",
    errorMessage: messages,
  });
};

exports.postRegister = async (req, res) => {
  const firtname = req.body.firstname;
  const lastname = req.body.lastname;
  const email = req.body.email;
  const password = req.body.password;
  const confirmPassword = req.body.confirmpassword;

  try {
    const existingUser = await Member.findOne({ "local.email": email });
    if (existingUser) {
      req.flash("error", "Mail exists already, please pick a different one.");
      return res.redirect("/register");
    }

    if (password !== confirmPassword) {
      req.flash("error", "Password not match.");
      return res.redirect("/register");
    }

    const hashedPassword = await bcrypt.hash(password, 5);

    const newMember = new Member({
      info: {
        firstname: firtname,
        lastname: lastname,
      },
      local: {
        email: email,
        password: hashedPassword,
      },
      image_path: "images/avatar/avatar-user.png",
      roles: "MEMBER",
      status: "ACTIVE",
    });

    const savedUser = await newMember.save();

    // Tự động đăng nhập cho thành viên mới đăng ký
    req.session.isLoggedIn = true;
    req.session.user = savedUser;
    await req.session.save();

    res.redirect("/chatapp");
  } catch (error) {
    console.log(error);
    res.redirect("/register");
  }
};

exports.getProfile = (req, res, next) => {
  res
    .render("frontend/home/profile", {
      pageTitle: "WebChat/Profile",
    })
    .catch((err) => console.log(err));
};

exports.postEditProfile = (req, res, next) => {
  let currentUserId = req.session.user._id;

  // console.log(req.file);

  var firstname =
    req.body.firstname !== null ? req.body.firstname : user.info.firstname;
  var lastname =
    req.body.lastname !== null ? req.body.lastname : user.info.lastname;

  Member.findOne({ _id: currentUserId })
    .then((user) => {
      // kiểm tra đổi ảnh không
      if (req.file === undefined) {
        user.info.firstname = firstname;
        user.info.lastname = lastname;

        req.flash("messageEditProfile", "Save changes successfullys");
        user.save().then(() => res.redirect("/chatapp"));
      } else {
        // xóa file ảnh cũ nếu đổi ảnh
        // let path = user.image_path.split('/');
        // let filePath = './public/uploads/avatar-user/' + path[path.length - 1];
        // fs.unlinkSync(filePath, (err) => {
        //     if (err) console.log("Couldn't delete image: " + user.image_path);
        // });

        user.image_path = "/uploads/avatar-user/" + req.file.filename;
        user.info.firstname = firstname;
        user.info.lastname = lastname;

        user.save().then(() => {
          req.flash("messageEditProfile", "Save changes successfullys");
          res.redirect("/chatapp");
        });
      }
    })
    .catch((err) => console.log(err));
};

exports.getChangePassword = (req, res, next) => {
  let messages = req.flash("error");
  if (messages.length > 0) {
    messages = messages[0];
  } else {
    messages = null;
  }
  res
    .render("frontend/home/changepassword", {
      pageTitle: "WebChat/Change Password",
      errorMessage: messages,
    })
    .catch((err) => console.log(err));
};

exports.postChangePassword = (req, res, next) => {
  let currentUserId = req.session.user._id;

  var curent_password = req.body.curent_password;
  var new_password = req.body.new_password;
  var comfirm_password = req.body.comfirm_password;

  Member.findOne({ _id: currentUserId })
    .then((user) => {
      bcrypt
        .compare(curent_password, user.local.password)
        .then((doMatch) => {
          if (doMatch) {
            req.session.isLoggedIn = true;
            req.session.user = user;
            req.session.save();
            if (new_password === comfirm_password) {
              bcrypt.hash(new_password, 5).then((hashedPassword) => {
                user.local.password = hashedPassword;
                user.save();
                return req.session.save((err) => {
                  if (err) console.log(err);
                  req.flash(
                    "messagesChangepassword",
                    "Change password successfully"
                  );
                  res.redirect("/chatapp");
                });
              });
            } else {
              req.flash("errorChangepassword", "Invalid comfirm password.");
              res.redirect("back");
            }
          } else {
            req.flash("errorChangepassword", "Invalid current password.");
            res.redirect("back");
          }
        })
        .catch((err) => {
          console.log(err);
          res.redirect("back");
        });
    })
    .catch((err) => console.log(err));
};
