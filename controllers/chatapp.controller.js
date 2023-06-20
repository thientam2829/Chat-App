const Member    = require('../models/member');
const Group     = require('../models/groupchat');
const Messages  = require('../models/messages');
const Contacts  = require('../models/contacts');
const Notifications = require('../models/notifications');

const multer    = require('multer');
const fsExtra   = require('fs-extra')

// import {lastItemOfArray, convertTimestampToHumanTime} from '../helper/clientHelper';

exports.home = async (req, res, next) => {
    let messagesWelcome = req.flash('messagesWelcome'); // message nhận từ flash của login
    if (messagesWelcome.length > 0) {
        messagesWelcome = messagesWelcome[0];
    } else {
        messagesWelcome = null;
    }

    let messagesChangepassword = req.flash('messagesChangepassword'); //message nhận từ flash của changepassword
    if (messagesChangepassword.length > 0) {
        messagesChangepassword = messagesChangepassword[0];
    } else {
        messagesChangepassword = null;
    }
    let errorChangepassword = req.flash('errorChangepassword');
    if (errorChangepassword.length > 0) {
        errorChangepassword = errorChangepassword[0];
    } else {
        errorChangepassword = null;
    }

    let messageEditProfile = req.flash('messageEditProfile'); //message nhận từ flash của edit profile
    if (messageEditProfile.length > 0) {
        messageEditProfile = messageEditProfile[0];
    } else {
        messageEditProfile = null;
    }
    
    let currentUserId = req.session.user._id;

    await Member.find().sort({"createdAt": -1}).then( async member => { //{ _id: req.session.user._id }
        await Contacts.find({
            $or: [
                {"memberId": currentUserId},
                {"contactId": currentUserId}
            ]
        }).sort({"createdAt": -1}).then( async contacts => {
            await Group.find().then( async group => {
                await Messages.find({
                    $or: [
                        {"senderId": currentUserId},
                        {"receiverId": currentUserId}
                    ]
                }).sort({"createdAt": 1}).then( async messages => { //.sort({"createdAt": 1}): sắp xếp theo thời gian cũ đến mới
                    // đếm toàn bộ số thông báo chưa đọc
                    await Notifications.count({
                        $and: [
                            {"receiverId": currentUserId},
                            {"isRead": false}
                        ]
                    }).then( async countNotiUnRead => {
                        // console.log(countNotiUnRead)
                        // lấy ta thông tin người dùng của thông báo
                        await Notifications.find({ "receiverId": currentUserId })
                        .sort({"createdAt": -1}) // sắp xếp mới về cũ
                        .limit(20) // giới hạn lấy ra là 20
                        .then( async notifications => {
                            // tìm đến các người dùng của thông báo để lấy thông tin
                            let getNotiContents = await notifications.map( async (notification) => {
                                // vì hàm (notification) trên không đợi sender ở dưới. mà cứ return luôn nên thành Promise
                                let sender = await Member.findById(notification.senderId).sort({"createdAt": -1}).then(item => {return item});
                                
                                if (notification.type == "add_contact") {
                                    if (!notification.isRead) {
                                        return `
                                            <div class="notif-readed-false" data-uid="${sender._id}">
                                                <img class="avatar-small" src="${sender.image_path}" alt=""> 
                                                <strong>
                                                    ${sender.info.firstname} ${sender.info.lastname}
                                                </strong> sent a contact request.
                                            </div>
                                        `;
                                    }
                                    return `
                                        <div data-uid="${sender._id}">
                                            <img class="avatar-small" src="${sender.image_path}" alt=""> 
                                            <strong>
                                                ${sender.info.firstname} ${sender.info.lastname}
                                            </strong> sent a contact request.
                                        </div>
                                    `;
                                } else {
                                    if (!notification.isRead) {
                                        return `
                                            <div class="notif-readed-false" data-uid="${sender._id}">
                                                <img class="avatar-small" src="${sender.image_path}" alt=""> 
                                                <strong>
                                                    ${sender.info.firstname} ${sender.info.lastname}
                                                </strong> accepted the contact request.
                                            </div>
                                        `;
                                    }
                                    return `
                                        <div data-uid="${sender._id}">
                                            <img class="avatar-small" src="${sender.image_path}" alt=""> 
                                            <strong>
                                                ${sender.info.firstname} ${sender.info.lastname}
                                            </strong> accepted the contact request.
                                        </div>
                                    `;
                                }
                            })
                            // tránh Promise object ở phía trên, ta dùng: await Promise.all()
                            let getNotiContentsToRender = await Promise.all(getNotiContents);
                                
                            await res.render('frontend/chatapp/home', {
                                pageTitle: 'WebChat',
                                member   : member,
                                group    : group,
                                messages : messages,
                                contacts : contacts,
                                notifications : notifications,
                                countNotiUnRead : countNotiUnRead,
                                getNotiContents : getNotiContentsToRender,
                                messagesWelcome : messagesWelcome,
                                messagesChangepassword : messagesChangepassword,
                                errorChangepassword : errorChangepassword,
                                messageEditProfile : messageEditProfile,
                            })
                        })
                    })
                })
            })
        })
    })
    .catch(err => console.log(err));
}

// gửi tin nhắn mới
exports.addNewTextEmoji = (req, res, next) => {
    try {
        // thông tin người gửi tn (người dùng hiện tại - current user)
        let sender = {
            id: req.session.user._id,
            name: req.session.user.info.firstname + ' ' + req.session.user.info.lastname,
            avatar: req.session.user.image_path
        };

        // lấy dữ liệu từ phía client truyền lên (từ file textAndEmojiChat.js)
        let receiverId = req.body.uid;
        let messagaVal = req.body.messagaVal;
        let isChatGroup = req.body.isChatGroup;

        let newMessage = new Messages();

        // kiểm tra xem chat cá nhân hay nhóm
        if (isChatGroup) {
            var conversType = 'group';

            // lấy thông tin người nhận tn thông qua id truyền từ client
            Group.findOne({_id: receiverId}).then(receiverFind => {

                let receiver = {
                    id: receiverFind._id,
                    name: receiverFind.name,
                    avatar: receiverFind.image_path
                }

                newMessage.senderId = req.session.user._id;
                newMessage.receiverId = receiverId;
                newMessage.conversationType = conversType;
                newMessage.messageType = 'text';
                newMessage.sender = sender;
                newMessage.receiver = receiver;
                newMessage.text = messagaVal;
                newMessage.createdAt = new Date();

                newMessage.save();
                return res.status(200).send({message: newMessage});
            });

        } else {
            var conversType = 'personal';

            // lấy thông tin người nhận tn thông qua id truyền từ client
            Member.findOne({_id: receiverId}).then(receiverFind => {

                let receiver = {
                    id: receiverFind._id,
                    name: receiverFind.info.firstname + ' ' + receiverFind.info.lastname,
                    avatar: receiverFind.image_path
                }

                newMessage.senderId = req.session.user._id;
                newMessage.receiverId = receiverId;
                newMessage.conversationType = conversType;
                newMessage.messageType = 'text';
                newMessage.sender = sender;
                newMessage.receiver = receiver;
                newMessage.text = messagaVal;
                newMessage.createdAt = new Date();

                newMessage.save();
                return res.status(200).send({message: newMessage});
            });
        }

    } catch (error) {
        return res.status(500).send(error);
    }
}
// IMAGE CHAT
// Upload File - upload image dành cho image-chat
let storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/uploads/image-chat/')
    },
    filename: (req, file, cb) => {
        let filename = file.originalname;
        cb(null, filename);
        // cb(null, Date.now() + '-' + filename): không sử dụng Date.now() vì ở fsExtra lấy tên file theo originalname,
        // sẽ không thể xóa được nếu không cùng tên
    },
    fileFilter: (req, file, callback) => {
        let ext = path.extname(file.originalname)
        if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
            return callback(null, false)
        }
        callback(null, true)
    }
});

let uploadNewImageChat = multer({
  storage: storage,
  limits: { fileSize: '4MB' }
}).single('my-image-chat'); // my-image-chat: name của input chứa ảnh tải lên

exports.addNewImage = (req, res, next) => {
    // tải ảnh lên server
    uploadNewImageChat(req, res, async (error) => {
        if (error) {
            return res.status(500).send(error);
        }

        try {
            // thông tin người gửi tn (người dùng hiện tại - current user)
            let sender = {
                id: req.session.user._id,
                name: req.session.user.info.firstname + ' ' + req.session.user.info.lastname,
                avatar: req.session.user.image_path
            };
    
            // lấy dữ liệu từ phía client truyền lên (từ file textAndEmojiChat.js)
            let receiverId = req.body.uid;
            let messagaVal = req.file; // file ở đây là ảnh
            let isChatGroup = req.body.isChatGroup;

            let newMessage = new Messages();
    
            // kiểm tra xem chat cá nhân hay nhóm
            if (isChatGroup) {
                var conversType = 'group';
    
                // lấy thông tin người nhận tin nhắn (ở đây là group) thông qua id truyền từ client
                Group.findOne({_id: receiverId}).then( async receiverFind => {
    
                    let receiver = {
                        id: receiverFind._id,
                        name: receiverFind.name,
                        avatar: receiverFind.image_path
                    }

                    // convert dữ liệu ảnh thành một buffer
                    let imageBuffer = await fsExtra.readFile(messagaVal.path);
                    let imageContentType = messagaVal.mimetype;
                    let imageName = messagaVal.originalname;
    
                    newMessage.senderId = req.session.user._id;
                    newMessage.receiverId = receiverId;
                    newMessage.conversationType = conversType;
                    newMessage.messageType = 'image';
                    newMessage.sender = sender;
                    newMessage.receiver = receiver;
                    newMessage.file = {data: imageBuffer, contentType: imageContentType, fileName: imageName},
                    newMessage.createdAt = new Date();
    
                    newMessage.save();

                    // xóa ảnh trên server đi, vì sẽ lưu ở dạng buffer lên mongodb
                    fsExtra.remove((`./public/uploads/image-chat/${newMessage.file.fileName}`));

                    return res.status(200).send({message: newMessage, isChatGroup: isChatGroup});
                });
    
            } else {
                var conversType = 'personal';
    
                // lấy thông tin người nhận tn thông qua id truyền từ client
                Member.findOne({_id: receiverId}).then( async receiverFind => {
    
                    let receiver = {
                        id: receiverFind._id,
                        name: receiverFind.info.firstname + ' ' + receiverFind.info.lastname,
                        avatar: receiverFind.image_path
                    }
                    
                    // convert dữ liệu ảnh thành một buffer
                    let imageBuffer = await fsExtra.readFile(messagaVal.path);
                    let imageContentType = messagaVal.mimetype;
                    let imageName = messagaVal.originalname;
    
                    newMessage.senderId = req.session.user._id;
                    newMessage.receiverId = receiverId;
                    newMessage.conversationType = conversType;
                    newMessage.messageType = 'image';
                    newMessage.sender = sender;
                    newMessage.receiver = receiver;
                    newMessage.file = {data: imageBuffer, contentType: imageContentType, fileName: imageName},
                    newMessage.createdAt = new Date();
    
                    newMessage.save();

                    // xóa ảnh trên server đi, vì sẽ lưu ở dạng buffer lên mongodb | tải lên sau đó xóa đi
                    fsExtra.remove((`./public/uploads/image-chat/${newMessage.file.fileName}`));

                    return res.status(200).send({message: newMessage});
                });
            }
    
        } catch (error) {
            return res.status(500).send(error);
        }
    })
}

// ATTACHMENT CHAT (tệp đính kèm)
// Upload File - upload image dành cho attachment-chat
let storageAttachment = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/uploads/attachment-chat/')
    },
    filename: (req, file, cb) => {
        let filename = file.originalname;
        cb(null, filename);
    },
    fileFilter: (req, file, callback) => {
        let ext = path.extname(file.originalname)
        if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
            return callback(null, false)
        }
        callback(null, true)
    }
});

let uploadNewAttachmentChat = multer({
  storage: storageAttachment,
  limits: { fileSize: '4MB' }
}).single('my-attachments-chat'); // my-attachments-chat: name của input chứa ảnh tải lên

exports.addNewAttachment = (req, res, next) => {
    // tải ảnh lên server
    uploadNewAttachmentChat(req, res, async (error) => {
        if (error) {
            return res.status(500).send(error);
        }

        try {
            // thông tin người gửi tn (người dùng hiện tại - current user)
            let sender = {
                id: req.session.user._id,
                name: req.session.user.info.firstname + ' ' + req.session.user.info.lastname,
                avatar: req.session.user.image_path
            };
    
            // lấy dữ liệu từ phía client truyền lên (từ file textAndEmojiChat.js)
            let receiverId = req.body.uid;
            let messagaVal = req.file; // file ở đây là tệp đính kèm
            let isChatGroup = req.body.isChatGroup;

            let newMessage = new Messages();
    
            // kiểm tra xem chat cá nhân hay nhóm
            if (isChatGroup) {
                var conversType = 'group';
    
                // lấy thông tin người nhận tin nhắn (ở đây là group) thông qua id truyền từ client
                Group.findOne({_id: receiverId}).then( async receiverFind => {
    
                    let receiver = {
                        id: receiverFind._id,
                        name: receiverFind.name,
                        avatar: receiverFind.image_path
                    }

                    // convert dữ liệu ảnh thành một buffer
                    let attachmentBuffer = await fsExtra.readFile(messagaVal.path);
                    let attachmentContentType = messagaVal.mimetype;
                    let attachmentName = messagaVal.originalname;
    
                    newMessage.senderId = req.session.user._id;
                    newMessage.receiverId = receiverId;
                    newMessage.conversationType = conversType;
                    newMessage.messageType = 'attachment';
                    newMessage.sender = sender;
                    newMessage.receiver = receiver;
                    newMessage.file = {data: attachmentBuffer, contentType: attachmentContentType, fileName: attachmentName},
                    newMessage.createdAt = new Date();
    
                    newMessage.save();

                    // xóa tệp đính kèm vừa tải lên server đi, vì sẽ lưu ở dạng buffer lên mongodb
                    fsExtra.remove((`./public/uploads/attachment-chat/${newMessage.file.fileName}`));

                    return res.status(200).send({message: newMessage, isChatGroup: isChatGroup});
                });
    
            } else {
                var conversType = 'personal';
    
                // lấy thông tin người nhận tn thông qua id truyền từ client
                Member.findOne({_id: receiverId}).then( async receiverFind => {
    
                    let receiver = {
                        id: receiverFind._id,
                        name: receiverFind.info.firstname + ' ' + receiverFind.info.lastname,
                        avatar: receiverFind.image_path
                    }
                    
                    // convert dữ liệu ảnh thành một buffer
                    let attachmentBuffer = await fsExtra.readFile(messagaVal.path);
                    let attachmentContentType = messagaVal.mimetype;
                    let attachmentName = messagaVal.originalname;
    
                    newMessage.senderId = req.session.user._id;
                    newMessage.receiverId = receiverId;
                    newMessage.conversationType = conversType;
                    newMessage.messageType = 'attachment';
                    newMessage.sender = sender;
                    newMessage.receiver = receiver;
                    newMessage.file = {data: attachmentBuffer, contentType: attachmentContentType, fileName: attachmentName},
                    newMessage.createdAt = new Date();
    
                    newMessage.save();

                    // xóa ảnh trên server đi, vì sẽ lưu ở dạng buffer lên mongodb
                    fsExtra.remove((`./public/uploads/attachment-chat/${newMessage.file.fileName}`));

                    return res.status(200).send({message: newMessage});
                });
            }
    
        } catch (error) {
            return res.status(500).send(error);
        }
    })
}

// tìm kiếm user để thêm vào group chat
exports.searchFriend = (req, res, next) => {
    try {
        let currentUserId = req.session.user._id;
        let keywork = req.params.keywork;
        // tìm kiếm theo email hoặc tên
        Member.find({
            $or: [
                {"local.email": new RegExp(keywork, 'i')},
                {"info.firstname": new RegExp(keywork, 'i')},
                {"info.lastname": new RegExp(keywork, 'i')}
            ]
        })
        .then(usersListSearch => {
            Contacts.find({
                // lấy ra những user đã là bạn bè từ bảng contact
                $or: [
                    {$and: [
                        {"memberId": currentUserId}
                    ]},
                    {$and: [
                        {"contactId": currentUserId}
                    ]},
                ]
            }).then(contactListSearch => {
                let userListSearchTemp = [];
                // lọc lấy những user đã là bạn bè
                for (contact_item of contactListSearch) {
                    for (user_item of usersListSearch) {
                        if (user_item._id.toString() === contact_item.contactId.toString()
                        && contact_item.status === true) {
                            userListSearchTemp.push(user_item)
                        }
                    }
                }
                // loại bỏ phần tử trùng
                let userListSearchToSend = [...userListSearchTemp.reduce((p,c) => p.set(c,true),new Map()).keys()];
                
                return res.status(200).send({userListSearchToSend: userListSearchToSend});
            })
        })
        .catch(error => {
            return res.status(500).send(error);
        });
    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.createGroupChat = (req, res, next) => {
    try {
        let currentUserId = req.session.user._id;

        let arrayIds = req.body.arrayIds;
        let groupChatName = req.body.groupChatName;

        var listUserId = JSON.parse(arrayIds); // đưa JSON về lại array
        listUserId.push(currentUserId); // thêm current userId vào mảng memberId

        let newGroup = new Group();

        newGroup.status     = "ACTIVE";
        newGroup.name       = groupChatName;
        newGroup.user_id    = currentUserId;
        newGroup.image_path = "images/avatar/avatar-group.png";
        newGroup.members    = listUserId;
        newGroup.createdAt  = new Date();

        // tìm các user là member của group mới được tạo
        Member.find({
            '_id': { $in: listUserId }
        }, function(err, memberList) {
            // console.log(userData);
            // lưu group mới tạo vào db và gửi trả về cho client
            newGroup.save(function (error, docs) {
                if (error) {
                    return res.status(500).send(error);
                }

                return res.status(200).send({
                    groupData: docs, // dữ liệu của group mới tạo
                    memberList: memberList // danh sách member
                });
            });
        });

    } catch (error) {
        return res.status(500).send(error);
    }
}

// tìm kiếm user để thêm vào group chat
exports.searchUser = (req, res, next) => {
    try {
        let currentUserId = req.session.user._id;
        let keywork = req.params.keywork;
        // tìm kiếm theo email hoặc tên
        Member.find({
            $or: [
                {"local.email": new RegExp(keywork, 'i')},
                {"info.firstname": new RegExp(keywork, 'i')},
                {"info.lastname": new RegExp(keywork, 'i')}
            ]
        })
        .then(usersListSearch => {
            Contacts.find({
                // lấy ra những user đã là bạn bè từ bảng contact
                $or: [
                    {$and: [
                        {"memberId": currentUserId}
                    ]},
                    {$and: [
                        {"contactId": currentUserId}
                    ]},
                ]
            }).then(contactListSearch => {
                let listIdContacts = [];
                for (let id_item of contactListSearch) {
                    listIdContacts.push(id_item.contactId);
                }

                // xóa dữ liệu current user khỏi mảng
                usersListSearch.forEach(function(user_item, index) {
                    if ( user_item._id.toString() === currentUserId.toString() ) {
                        delete usersListSearch[index];
                    }
                })

                // xóa dữ liệu user đã là bạn bè
                for (let contact_item of contactListSearch) {
                    usersListSearch.forEach(function(user_item, index) {
                        if ( (user_item._id.toString() === contact_item.contactId.toString())
                        || (user_item._id.toString() === contact_item.memberId.toString()) ) {
                            delete usersListSearch[index];
                        }
                    })
                }
                // loại bỏ các phần tử (property): "", 0, false, null, undedined khỏi object
                // let userListSearchToSend = Object.entries(usersListSearch).reduce((a,[k,v]) => (v ? {...a, [k]:v} : a), {})

                return res.status(200).send({userListSearchToSend: usersListSearch});
            })
        })
        .catch(error => {
            return res.status(500).send(error);
        });
    } catch (error) {
        return res.status(500).send(error);
    }
}

// add contacts - kết bạn
exports.addNewContact = (req, res, next) => {
    try {
        let currentUserId = req.session.user._id;
        let contactId = req.body.uid;

        let newContactItem = new Contacts();

        // kiểm tra xem 2 người dùng đã là bạn bè chưa
        Contacts.findOne({
            $or: [
                {$and: [
                    {"memberId": currentUserId},
                    {"contactId": contactId}
                ]},
                {$and: [
                    {"contactId": currentUserId},
                    {"memberId": contactId}
                ]},
            ]
        }).then(contactExits => {
            // nếu tồn tại (đã là bạn bè)
            if (contactExits) {
                return res.status(200).send({contactExits: contactExits});
            }
            else {
                // thêm bạn
                newContactItem.memberId = currentUserId;
                newContactItem.contactId = contactId;
                newContactItem.save();

                // tạo thông báo mới
                let newNotification = new Notifications();
                newNotification.senderId = currentUserId;
                newNotification.receiverId = contactId;
                newNotification.type = 'add_contact';
                newNotification.isRead = false;
                newNotification.save();

                let success = true;

                return res.status(200).send({
                    newContactItem: newContactItem, 
                    success: success
                });
            }
        });
    } catch (error) {
        return res.status(500).send(error)
    }
}

// hủy yêu cầu kết bạn người dùng gửi đi - remove request contact sent
exports.removeRequestContactSent = async (req, res, next) => {
    try {
        let currentUserId = req.session.user._id;
        let contactId = req.body.uid;

        await Contacts.findOne({"memberId": currentUserId, "contactId": contactId})
        .then( async removeRequest => {
            // xóa yêu cầu kết bạn
            removeRequest.remove();
            
            await Notifications.findOne({
                $and: [
                    {"senderId": currentUserId},
                    {"receiverId": contactId},
                    {"type": "add_contact"}
                ]
            }).then(noti => {
                // xóa thông báo
                noti.remove();

                return res.status(200).send(true);
            })
        })
    } catch (error) {
        return res.status(500).send(error)
    }
}

// hủy yêu cầu kết bạn người dùng nhận được - remove request contact received
exports.removeRequestContactReceived = async (req, res, next) => {
    try {
        let currentUserId = req.session.user._id;
        let contactId = req.body.uid;

        await Contacts.findOne({"memberId": contactId, "contactId": currentUserId})
        .then( async removeRequest => {
            // xóa yêu cầu kết bạn
            removeRequest.remove();
            
            await Notifications.findOne({
                $and: [
                    {"senderId": contactId},
                    {"receiverId": currentUserId},
                    {"type": "add_contact"}
                ]
            }).then(noti => {
                // xóa thông báo
                // noti.remove();

                return res.status(200).send(true);
            })
        })
    } catch (error) {
        return res.status(500).send(error)
    }
}

// đồng ý kết bạn
exports.accceptRequestContactReceived = async (req, res, next) => {
    try {
        let currentUserId = req.session.user._id;
        let contactId = req.body.uid;

        await Contacts.findOne({"memberId": contactId, "contactId": currentUserId})
        .then( async removeRequest => {
            // đổi trang thái kết bạn thành true
            removeRequest.status = true;
            removeRequest.save();
            
            await Notifications.findOne({
                $and: [
                    {"senderId": contactId},
                    {"receiverId": currentUserId},
                    {"type": "add_contact"}
                ]
            }).then(async noti => {
                // đổi trạng thái thông báo thành đã đọc
                noti.isRead = true;
                await noti.save();

                // tạo thông báo mới và lưu (thông báo chấp nhận kết bạn)
                let newNitiAccept = new Notifications();
                newNitiAccept.senderId = currentUserId;
                newNitiAccept.receiverId = contactId;
                newNitiAccept.type = 'accept_contact';
                newNitiAccept.isRead = false;
                await newNitiAccept.save();

                await Member.findOne({"_id": contactId}).then(newContact => {
                    return res.status(200).send({newContact: newContact});
                })
            })
        })
    } catch (error) {
        return res.status(500).send(error)
    }
}

// đánh dấu tất cả thông báo đã đọc
exports.markAllNotifiAsRead = async (req, res, next) => {
    try {
        let currentUserId = req.session.user._id;
        let targetUserJson = req.body.targetUserJson;
        // chuyển Json thành mảng lại
        let targetUser = JSON.parse(targetUserJson)
        
        await Notifications.find({
            $and: [
                {"receiverId": currentUserId},
                {"senderId": {$in: targetUser}} // truyền mảng gồm các senderId của các notification | $in: nằm trong | $notin: không nằm trong
            ]
        }) 
        .then(mark => {
            // update isRead thành true
            mark.forEach(item => {
                item.isRead = true;
                item.save();
            });

            return res.status(200).send({mark: mark});
        })
        
    } catch (error) {
        return res.status(500).send(error);
    }
}

// hủy kết bạn
exports.removeContact = async (req, res, next) => {
    try {
        let currentUserId = req.session.user._id;
        let contactId = req.body.uid;

        await Contacts.findOne({
            $or: [
                {$and: [
                    {"memberId": currentUserId},
                    {"contactId": contactId}
                ]},
                {$and: [
                    {"contactId": currentUserId},
                    {"memberId": contactId}
                ]},
            ]
        })
        .then( async removeRequest => {
            // xóa yêu cầu kết bạn
            removeRequest.remove();
            
            return res.status(200).send({contactId: contactId});
        })
    } catch (error) {
        return res.status(500).send(error)
    }
}