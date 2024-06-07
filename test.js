const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const path = require("path");
const bcrypt = require("bcrypt");

const app = express();

const serviceAct = require("./key.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAct),
});

const db = admin.firestore();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const saltRounds = 10;

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.post("/signup", async (req, res) => {
  const { username, email, phone, password, confirm_password } = req.body;

  if (password !== confirm_password) {
    return res.status(400).render("passmismatch");
  }

  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).render("invalid-phone");
  }

  try {
    const exist = await db
      .collection("users")
      .where("email", "==", email)
      .get();
    if (!exist.empty) {
      return res.status(400).render("mexists");
    }

    const hashedPwd = await bcrypt.hash(password, saltRounds);

    await db.collection("users").add({
      username,
      email,
      phone,
      password: hashedPwd,
    });

    res.redirect("/login");
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const exist = await db
      .collection("users")
      .where("email", "==", email)
      .get();
    if (exist.empty) {
      return res.status(401).render("logfail");
    }
    const user = exist.docs[0].data();
    const pwdMatch = await bcrypt.compare(password, user.password);
    if (pwdMatch) {
      res.render("logsuc", { username: user.username });
    } else {
      res.status(401).render("logfail");
    }
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
