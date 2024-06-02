const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const ent = require("ent");

const app = express();

app.use(
  require("helmet")({
    contentSecurityPolicy: false,
  })
);
app.use(
  session({
    name: "quaker",
    secret: process.env.SESSION_SECRET || "ss",
    resave: true,
    saveUninitialized: false,
  })
);
app.use(bodyParser.urlencoded({ extended: false }));
app.set("view engine", "ejs");

var mongouri = process.env.DB_URI;
console.log(mongouri);
var mongojs = require("mongojs");
var db = mongojs(mongouri, ["store"]);

app.get("/", (req, res) => {
  res.redirect("/" + Math.random().toString(36).slice(-5));
});

app.get("/:name/manifest.json", (req, res) => {
  res.render("manifest", { name: req.params.name });
});

app.get("/:name", (req, res) => {
  const name = req.params.name;
  getDoomp(name, (doomp) => {
    if (redirectToLogin(req, res, doomp)) return;
    if (doomp.list) {
      res.redirect("/" + name + "/list");
      return;
    }
    res.render("default", { doomp });
  });
});

app.get("/:name/list", (req, res) => {
  const name = req.params.name;
  getDoomp(name, (doomp) => {
    if (redirectToLogin(req, res, doomp)) return;
    res.render("list", { doomp });
  });
});

app.get("/:name/unlist", (req, res) => {
  const name = req.params.name;
  getDoomp(name, (doomp) => {
    if (redirectToLogin(req, res, doomp)) return;
    db.store.update({ name: name }, { $set: { list: false } }, () => {
      res.redirect("/" + name);
    });
  });
});

app.get("/:name/raw", (req, res) => {
  const name = req.params.name;
  getDoomp(name, (doomp) => {
    if (redirectToLogin(req, res, doomp)) return;
    res.type("text/plain");
    res.send(ent.decode(doomp.content || ""));
  });
});

app.post("/:name", (req, res) => {
  const name = req.params.name;
  console.log("req.body.content", req.body.content);
  const content = ent.encode(req.body.content);
  const list = req.body.list ? true : false;
  getDoomp(name, (doomp) => {
    if (redirectToLogin(req, res, doomp)) return;
    db.store.update(
      { name: name },
      { $set: { name, content, list } },
      { upsert: true },
      () => {
        res.send("OK");
      }
    );
  });
});

app.get("/:name/protect", (req, res) => {
  const name = req.params.name;
  getDoomp(name, (doomp) => {
    if (redirectToLogin(req, res, doomp)) return;
    res.render("protect", { name });
  });
});

app.post("/:name/protect", (req, res) => {
  const name = req.params.name;
  const password = ent.encode(req.body.password);
  db.store.update(
    { name: name },
    { $set: { protected: true, password: password } },
    { upsert: true },
    () => {
      req.session[name] = password;
      res.redirect(`/${name}`);
    }
  );
});

app.get("/:name/login", (req, res) => {
  const name = req.params.name;
  db.store.findOne({ name }, (err, doomp) => {
    if (err) {
      console.error(err);
    }
    if (!doomp || isAuthenticated(req.session, doomp)) {
      res.redirect(`/${name}`);
    } else {
      res.render("login", { doomp });
    }
  });
});

app.post("/:name/login", (req, res) => {
  const name = req.params.name;
  const password = req.body.password;
  getDoomp(name, (doomp) => {
    if (password === doomp.password) {
      req.session[name] = doomp.password;
      res.redirect(`/${name}`);
    } else {
      res.redirect(`/${name}/login`);
    }
  });
});

app.get("/:name/logout", (req, res) => {
  const name = req.params.name;
  req.session[name] = undefined;
  res.redirect(`/${name}`);
});

function getDoomp(name, callback) {
  db.store.findOne({ name }, (err, doomp) => {
    if (err) {
      console.error(err);
    }
    if (!doomp) {
      doomp = { name: name, content: "" };
    }
    callback(doomp);
  });
}

function redirectToLogin(req, res, doomp) {
  if (isProtected(doomp) && !isAuthenticated(req.session, doomp)) {
    res.redirect(`/${req.params.name}/login`);
    return true;
  }
}

function isProtected(doomp) {
  return doomp && doomp.protected;
}

function isAuthenticated(session, doomp) {
  return session[doomp.name] == doomp.password;
}

module.exports = app;
