const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "password",
  database: "notesdb"
});

db.connect();

app.post("/notes", (req, res) => {
  const { userId, text } = req.body;
  db.query("INSERT INTO notes (user_id, text) VALUES (?, ?)", [userId, text], (err) => {
    if (err) return res.status(500).send(err);
    res.send("Note added");
  });
});

app.get("/notes/:userId", (req, res) => {
  const { userId } = req.params;
  db.query("SELECT * FROM notes WHERE user_id=? ORDER BY id DESC", [userId], (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

app.delete("/notes/:id", (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM notes WHERE id=?", [id], (err) => {
    if (err) return res.status(500).send(err);
    res.send("Deleted");
  });
});

app.listen(3002);
