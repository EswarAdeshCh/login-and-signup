const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const path = require("path");
const bcrypt = require("bcrypt");
const axios = require("axios");

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
  res.render("signup", { error: null });
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
      res.render("dashboard", {
        username: user.username,
        word: null,
        definition: null,
        partOfSpeech: null,
        phonetic: null,
        audio: null,
        example: null,
      });
    } else {
      res.status(401).render("logfail");
    }
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

app.post("/dashboard", async (req, res) => {
  const { word, username } = req.body;
  try {
    const response = await axios.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
    );
    const definition = response.data[0].meanings[0].definitions[0].definition;
    const partOfSpeech = response.data[0].meanings[0].partOfSpeech;
    const phonetic =
      response.data[0].phonetic || response.data[0].phonetics[0].text;
    const audio = response.data[0].phonetics[0].audio || "";
    const example = response.data[0].meanings[0].definitions[0].example || "";

    res.render("dashboard", {
      username,
      word,
      definition,
      partOfSpeech,
      phonetic,
      audio,
      example,
    });
  } catch (err) {
    res.status(500).send("Error fetching word definition: " + err.message);
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
