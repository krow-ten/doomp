var express = require('express');
var bodyParser = require('body-parser')
var session = require('express-session');
var escape = require("html-escape");

var app = express()
app.use(require('helmet')());
app.use(session({name: 'quaker', secret: process.env.SESSION_SECRET || 'ss', resave: true, saveUninitialized: false}));
app.use(bodyParser.urlencoded({ extended: false }))
app.set('view engine', 'ejs');


var mongouri = process.env.MONGOHQ_URL
console.log(mongouri)
var mongojs = require('mongojs')
var db = mongojs(mongouri, ['store'], {})


app.get('/', (req, res) => {
   res.redirect('/'+(Math.random().toString(36).slice(-5)));
});

app.get('/:name', (req, res) => {
  db.store.findOne({name: req.params.name}, (err, doomp) => {
    if (err) { console.error(err) }
    if (!doomp) { doomp = { name: req.params.name, content: '' } }
    if (redirectToLogin(req, res, doomp)) return;
    res.render('default', {doomp}); 
  })
});

app.get('/:name/raw', (req, res) => {
  db.store.findOne({name: req.params.name}, (err, doomp) => {
    if (err) { console.error(err) }
    if (!doomp) { doomp = { content: '' } }
    if (redirectToLogin(req, res, doomp)) return;
    res.send(doomp.content); 
  })
});


app.post('/:name', (req, res) => {
  db.store.findOne({name: req.params.name}, (err, doomp) => {
    if (err) { console.error(err) }
    if (redirectToLogin(req, res, doomp)) return;
    db.store.update(
      { name: req.params.name },
      { $set:  {name: req.params.name, content: escape(req.body.content) }},
      { upsert: true },
      () => {
        res.send('OK');
      }
    )
  })
});

app.get('/:name/protect', (req, res) => {
  db.store.findOne({name: req.params.name}, (err, doomp) => {
    if (err) { console.error(err) }
    if (redirectToLogin(req, res, doomp)) return;
    res.render('protect', {doomp}); 
  })  
});

app.post('/:name/protect', (req, res) => {
  var name = req.params.name;
  var password = escape(req.body.password);
  db.store.update(
    { name: name },
    { $set:  { protected: true, password: password }},
    { upsert: true },
    () => {
      req.session[name] = password;
      res.redirect(`/${name}`);
    }
  )  
});

app.get('/:name/login', (req, res) => {
  var name = req.params.name;
  db.store.findOne({name}, (err, doomp) => {
    if (err) { console.error(err) }
    if (!doomp || isAuthenticated(req.session, doomp)) {
      res.redirect(`/${name}`);  
    } 
    else {
      res.render('login', {doomp});       
    }
  })  
});

app.post('/:name/login', (req, res) => {
var name = req.params.name;
var password = req.body.password;
  db.store.findOne({name}, (err, doomp) => {
    if (err) { console.error(err) }
    if (password === doomp.password) {
      req.session[name] = doomp.password
      res.redirect(`/${name}`)
    }
    else {
      res.redirect(`/${name}/login`);
    }
  })    
});

app.get('/:name/logout', (req, res) => {
  var name = req.params.name;
  req.session[name] = undefined;
  res.redirect(`/${name}`)
});


function redirectToLogin(req, res, doomp) {
  if (isProtected(doomp) && !isAuthenticated(req.session, doomp)) {
    res.redirect(`/${req.params.name}/login`);
    return true;
  }
}

function isProtected(doomp) {
  return doomp && doomp.protected
}

function isAuthenticated(session, doomp) {
  return session[doomp.name] == doomp.password
}


var port = Number(process.env.PORT || 5000);
app.listen(port, function() {
  console.log("Listening on " + port);
});