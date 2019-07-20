const express = require("express");
const socketIO = require("socket.io");
const bodyParser = require("body-parser");
const session = require("express-session");
const ent = require("ent");

const app = express();
app.use(require("helmet")());
app.use(
  session({
    name: "quaker",
    secret: process.env.SESSION_SECRET || "ss",
    resave: true,
    saveUninitialized: false
  })
);
app.use(bodyParser.urlencoded({ extended: false }));
app.set("view engine", "ejs");

var mongouri = process.env.MONGODB_URI;
console.log(mongouri);
var mongojs = require("mongojs");
var db = mongojs(mongouri, ["store"], { authMechanism: "SCRAM-SHA-1" });

app.get("/", (req, res) => {
  res.redirect(
    "/" +
      Math.random()
        .toString(36)
        .slice(-5)
  );
});

app.get("/:name/manifest.json", (req, res) => {
  res.render("manifest", { name: req.params.name });
});

app.get("/:name", (req, res) => {
  const name = req.params.name;
  getDoomp(name, doomp => {
    if (redirectToLogin(req, res, doomp)) return;
    if (doomp.list) {
      res.redirect("/" + name + "/list");
    }
    res.render("default", { doomp });
  });
});

app.get("/:name/list", (req, res) => {
  const name = req.params.name;
  getDoomp(name, doomp => {
    if (redirectToLogin(req, res, doomp)) return;
    res.render("list", { doomp });
  });
});

app.get("/:name/unlist", (req, res) => {
  const name = req.params.name;
  getDoomp(name, doomp => {
    if (redirectToLogin(req, res, doomp)) return;
    db.store.update({ name: name }, { $set: { list: false } }, () => {
      res.redirect("/" + name);
    });
  });
});

app.get("/:name/raw", (req, res) => {
  const name = req.params.name;
  getDoomp(name, doomp => {
    if (redirectToLogin(req, res, doomp)) return;
    res.type("text/plain");
    res.send(ent.decode(doomp.content));
  });
});

app.post("/:name", (req, res) => {
  const name = req.params.name;
  const content = ent.encode(req.body.content);
  const list = req.body.list ? true : false;
  getDoomp(name, doomp => {
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
  getDoomp(name, doomp => {
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
  getDoomp(name, doomp => {
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

const port = Number(process.env.PORT || 5000);
const server = app.listen(port, () => console.log("Listening on " + port));

const io = socketIO(server);
const clients = {};

io.on("connection", socket => {
  socket.on("register", data => {
    clients[data.name]
      ? clients[data.name].push(socket.id)
      : (clients[data.name] = [socket.id]);
    socket.on("disconnect", () => {
      for (var name in clients) {
        clients[name] = clients[name].filter(socketId => socketId != socket.id);
      }
    });
  });
  socket.on("content", data => {
    clients[data.name].forEach(clientSocket => {
      if (io.sockets.connected[clientSocket] && socket.id != clientSocket) {
        io.sockets.connected[clientSocket].emit("content", data.content);
      }
    });
  });
});
