const FuzzyMatching = require("fuzzy-matching");
const fs = require("fs");
const path = require("path");
const { gpt3 } = require("./gpt3");
const { prompts: memories } = require("../prompts/memories");

const { profile: lisaProfile } = require("../profiles/")

const { profile: sherlockProfile } = require("../profiles/sherlock");
const { profile: omegaProfile } = require("../profiles/omega");
const { profile: lisaProfile } = require("../profiles/lisa");
const { profile: confuciusProfile } = require("../profiles/confucius");
const { profile: sunProfile } = require("../profiles/sun");
const { profile: lewisProfile } = require("../profiles/lewis");
const { profile: carlProfile } = require("../profiles/carl");
const { profile: thalesProfile } = require("../profiles/thales");

// TODO - make this less shit (loading of profiles)
const profiles = [
  sherlockProfile,
  omegaProfile,
  lisaProfile,
  sunProfile,
  confuciusProfile,
  lewisProfile,
  carlProfile,
  thalesProfile,

];
let lastProfile = thalesProfile;

// use config
const MAX_MEMORIES = 5;

const findProfile = (text) => {
  console.log("=== FIND PROFILE ===");
  const firstWord = text.split(" ")[0].replace(",", "");
  //todo loop over profiles to make this array
  const bots = [
    "Omega",
    "Sherlock",
    "Lewis",
    "Thales",
    "Sun",
    "Confucius",
    "Carl",
    "Lisa"
  ];
  // const profileMatch = bots[Math.floor(Math.random() * bots.length)]; // default
  let selectedProfile = lastProfile;

  // find first mention of name
  let bestMatch = 0;
  const words = text.split(" ");
  words.forEach((w) => {
    profiles.forEach((profile) => {
      var fm = new FuzzyMatching(profile.alias);
      const score = fm.get(w.toLowerCase()).distance;
      if (score > 0.8) {
        if (score > bestMatch) {
          bestMatch = score;
          selectedProfile = profile;
        }
      }
    });
  });

  // check for exact match
  profiles.forEach((profile) => {
    var fm = new FuzzyMatching(profile.alias);
    console.log(
      firstWord,
      profile.alias,
      fm.get(firstWord.toLowerCase()).distance
    );
    if (fm.get(firstWord.toLowerCase()).distance > 0.6) {
      selectedProfile = profile;
    }
  });

  console.log("=== FIND PROFILE ===", selectedProfile);
  lastProfile = selectedProfile;
  return selectedProfile;
};

const createMemory = async (name, messages) => {
  console.log("=== CREATE MEMORY ===");
  console.log(name, messages);
  const memoryPrompt = await memories.prompt(name, messages.join("\n"));
  console.log(memoryPrompt);
  const memorySummary = await gpt3(memoryPrompt, ["\n", "People:", "."]);
  console.log("====== THE MEMORY SUMMARY ======");
  console.log(memorySummary);
  console.log("====== THE MEMORY SUMMARY ======");
  const realMemory = `${memorySummary}\n`;
  const profilePath = path.join(
    __dirname,
    `../../memories/${name.toLowerCase()}.json`
  );
  // const profile = require(path.join()`./profiles/${name}.js`);
  if (fs.existsSync(profilePath)) {
    const profileMemory = JSON.parse(fs.readFileSync(profilePath, "utf8"));
    profileMemory.push(realMemory);
    fs.writeFileSync(profilePath, JSON.stringify(profileMemory), "utf8");
  } else {
    fs.writeFileSync(profilePath, JSON.stringify([realMemory]), "utf8");
  }
  // check messages, did the bot talk 2-3 times in a row, if so create memory
  // send async to gpt3 a summarisation of the past config.sentences
  // read profile from disk
  // append memory
  console.log("=== CREATE MEMORY ===");
};

module.exports = {
  findProfile,
  createMemory,
};
