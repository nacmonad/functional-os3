//  OpenShift sample Node application
var express = require('express'),
    app     = express(),
    bcrypt = require('bcryptjs'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    csrf = require('csurf'),
    moment = require('moment-timezone'),
    morgan  = require('morgan'),
    sessions = require('client-sessions'),
    User = require('./models/user'),
    Blog = require('./models/blogs'),
    Comment = require('./models/comment');

Object.assign=require('object-assign')

app.engine('html', require('ejs').renderFile);
app.use(morgan('combined'))
app.use(express.static(__dirname));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// authentication & session middlewares
app.use(sessions({ //hide this doc in a different file!
	cookieName: 'session',
	secret: '1h2k3la9dfk9djskjdf90bne22jk',
	duration: 30 * 60 * 1000,
	activeDuration: 5 * 60 * 1000,
	httpOnly: true, // don't let browser js access cookies
	secure: true, // only use cookies over https
	ephemeral:true, // dlete cookie when browser is closed
}));
app.use(cookieParser('secret'));

app.use(function(req,res,next){
	if( req.session && req.session.user) {
		User.findOne({email:req.session.user.email}, function(err,user){
			if(user){
				req.user = user;
				delete req.user.password;  //delete pw in memory as soon as used
				req.session.user = user;
				res.locals.user = user;
			}
			next();
		})
	} else {
		next();
	}
});

app.use(csrf());
app.use(function (req, res, next) {
    res.cookie("XSRF-TOKEN",req.csrfToken());
    next();
});

function requireLogin(req,res,next) {
	if(!req.user){
		res.redirect('/auth/login');
	} else {
		next();
	}
}

function requireLoginAPI(req,res,next) {
	if(!req.user){
		res.send('Login required for this API access. ');
	} else {
		next();
	}
}

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0',
    mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL,
    mongoURLLabel = "";

if (mongoURL == null && process.env.DATABASE_SERVICE_NAME) {
  var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase(),
      mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'],
      mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'],
      mongoDatabase = process.env[mongoServiceName + '_DATABASE'],
      mongoPassword = process.env[mongoServiceName + '_PASSWORD']
      mongoUser = process.env[mongoServiceName + '_USER'];

  if (mongoHost && mongoPort && mongoDatabase) {
    mongoURLLabel = mongoURL = 'mongodb://';
    if (mongoUser && mongoPassword) {
      mongoURL += mongoUser + ':' + mongoPassword + '@';
    }
    // Provide UI label that excludes user id and pw
    mongoURLLabel += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
    mongoURL += mongoHost + ':' +  mongoPort + '/' + mongoDatabase;

  }
}
var db = null,
    dbDetails = new Object();

var initDb = function(callback) {
  if (mongoURL == null) return;

  var mongodb = require('mongodb');
  if (mongodb == null) return;

  mongodb.connect(mongoURL, function(err, conn) {
    if (err) {
      callback(err);
      return;
    }

    db = conn;
    dbDetails.databaseName = db.databaseName;
    dbDetails.url = mongoURLLabel;
    dbDetails.type = 'MongoDB';

    console.log('Connected to MongoDB at: %s', mongoURL);
  });
};

app.get('/', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    var col = db.collection('counts');
    // Create a document with request IP and current time of request
    col.insert({ip: req.ip, date: Date.now()});
    col.count(function(err, count){
      res.render('index.html', { pageCountMessage : count, dbInfo: dbDetails });
    });
  } else {
    res.render('index.html', { pageCountMessage : null});
  }
});

app.get('/pagecount', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    db.collection('counts').count(function(err, count ){
      res.send('{ pageCount: ' + count + '}');
    });
  } else {
    res.send('{ pageCount: -1 }');
  }
});
//API
app.get('/barsrgb', function(req, res) {
	res.sendFile(__dirname+'/barsrgb.html');
});

//API Express Setup
var apiRoutes = express.Router();   // this doesn't work in openshift
app.use('/api', apiRoutes);
apiRoutes.get("/blogs", function (req,res) {
		Blog
			.find({})
			//.skip(req.headers.skip ? parseInt(req.headers.skip) :  0)
			//.limit(req.headers.limit ? parseInt(req.headers.limit) : 5)
			.sort({ date:-1 })
			.exec(function (err,blogs) {
				if (err) throw err;
				if (!blogs) {
					return res.status(403).send({success:false, msg:'No blog found.'});
				}
				else {
					res.json(blogs);
					}
				});
	});

apiRoutes.post("/blogs", requireLoginAPI, function (req,res) {
		var newpost = new Blog(req.body);
		console.log(newpost);
		newpost.save(function (err,blog) {
			if (err) console.log(err);
			if (!blog) {
				res.status(403).send({success:false, msg:'There was an error posting the blog'});
			}
			else {
				res.json(blog);
			}
		});
	});

apiRoutes.put("/blogs/:id", requireLoginAPI, function (req,res) {
		Blog.findOneAndUpdate({_id:req.params.id}, req.body, function (err, blog) {
		  if (err) {console.log(err);}
		  if (!blog) {
		  	return res.status(403).send({success:false, msg:'Couldn\'t edit blog with id'})
		  }
		  else {
		  		res.json(blog);
		  }

		});

	});

apiRoutes.delete("/blogs/:id", requireLoginAPI, function (req,res) {
		Blog
			.remove({"_id": req.params.id})
			.exec(function (err,blog) {
				if (err) {console.log(err)};
				if (!blog) {
					return res.status(403).send({success:false, msg:'No blog found with ID'});
				}
				else {
					res.json(blog);
					}
				});
	});

apiRoutes.get("/blogs/:id", function (req,res) {
		Blog
			.findOne({"_id": req.params.id})
			.exec(function (err,blogs) {
				if (err) {console.log(err)};
				if (!blogs) {
					return res.status(403).send({success:false, msg:'No blog found with ID'});
				}
				else {
					res.json(blogs);
					}
				});
	});
//get blog by author
apiRoutes.get("/blogs/authors/:name", function (req,res) {
		Blog
			.find({"author": req.params.name})
			.exec(function (err,blogs) {
				if (err) {console.log(err)};
				if (!blogs) {
					return res.status(403).send({success:false, msg:'No blogs found by author.'});
				}
				else {
					res.json(blogs);
					}
				});
	});

apiRoutes.get("/comments", function (req,res) {
		Comment
			.find({})
			//.skip(req.headers.skip ? parseInt(req.headers.skip) :  0)
			//.limit(req.headers.limit ? parseInt(req.headers.limit) : 5)
			.sort({ date:-1 })
			.exec(function (err,comments) {
				if (err) throw err;
				if (!comments) {
					return res.status(403).send({success:false, msg:'No comments found.'});
				}
				else {
					res.json(comments);
					}
				});
	});
apiRoutes.get("/comments/:id", function (req,res) {
		Comment
			.find({"_id":req.params.id})
			//.skip(req.headers.skip ? parseInt(req.headers.skip) :  0)
			//.limit(req.headers.limit ? parseInt(req.headers.limit) : 5)
			.sort({ date:-1 })
			.exec(function (err,comments) {
				if (err) throw err;
				if (!comments) {
					return res.status(403).send({success:false, msg:'No comment found by that id.'});
				}
				else {
					res.json(comments);
					}
				});
	});
apiRoutes.get("/blogs/comments/:id", function (req,res) {
		Comment
			.find({"discussion_id":req.params.id})
			.sort({ date:-1 })
			.exec(function (err,comments) {
				if (err) throw err;
				if (!comments) {
					return res.status(403).send({success:false, msg:'Problem retrieving comments for that discussion.'});
				}
				else {
					res.json(comments);
					}
				});
		});
apiRoutes.delete("/comments/:id", requireLoginAPI, function (req,res) {
		Comment
			.remove({"_id": req.params.id})
			.exec(function (err,comment) {
				if (err) {console.log(err)};
				if (!comment) {
					return res.status(403).send({success:false, msg:'No comment found with ID'});
				}
				else {
					res.json(comment);
					}
				});
	});

apiRoutes.post("/comments", function (req,res) {
		var newpost = new Comment(req.body);
		console.log(newpost);
		newpost.save(function (err,comment) {
			if (err) console.log(err);
			if (!comment) {
				res.status(403).send({success:false, msg:'There was an error posting the comment'});
			}
			else {
				res.json(comment);
			}
		});
	});

//my google
apiRoutes.get("/scripts/:id", function(req,res) {
	res.send(
	'document.getElementsByClassName("tv-dialog__overlay")[0].style.zIndex ="-111";' +
	'document.getElementsByClassName("tv-dialog__modal-wrap")[0].style.zIndex ="-111"'
	);
});

//moment.timezone fun
apiRoutes.get('/time', function (req,res) {
	res.json(moment().tz("Europe/London").format('HH:mm:ss'));
});

//AUTH




// error handling
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.status(500).send('Something bad happened!');
});

initDb(function(err){
  console.log('Error connecting to Mongo. Message:\n'+err);
});

app.listen(port, ip);
console.log('Server running on http://%s:%s', ip, port);

module.exports = app ;
