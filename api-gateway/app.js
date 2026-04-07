const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(cors());

const USER_SERVICE = process.env.USER_SERVICE || "http://localhost:3001";
const NOTES_SERVICE = process.env.NOTES_SERVICE || "http://localhost:3002";

app.post("/register", async (req, res) => {
  try {
    const response = await axios.post(`${USER_SERVICE}/register`, req.body);
    res.send(response.data);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/login", async (req, res) => {
  try {
    const response = await axios.post(`${USER_SERVICE}/login`, req.body);
    res.json(response.data);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/notes", async (req, res) => {
  try {
    const response = await axios.post(`${NOTES_SERVICE}/notes`, req.body);
    res.send(response.data);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/notes/:userId", async (req, res) => {
  try {
    const response = await axios.get(`${NOTES_SERVICE}/notes/${req.params.userId}`);
    res.json(response.data);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.delete("/notes/:id", async (req, res) => {
  try {
    const response = await axios.delete(`${NOTES_SERVICE}/notes/${req.params.id}`);
    res.send(response.data);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(3000);
