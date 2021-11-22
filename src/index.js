require("dotenv").config();
var player = require("play-sound")((opts = {}));
const util = require("util");
const textToSpeech = require("@google-cloud/text-to-speech");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const UIDGenerator = require("uid-generator");
const isEnglish = require("is-english");

const config = require("./config");
const { gpt3 } = require("./lib/gpt3");
const { sleep } = require("./lib/sleep");
const { findProfile, createMemory } = require("./lib/profile");
const wsrn = require("./lib/wsrn");

const uidgen = new UIDGenerator();
const newclient = new textToSpeech.TextToSpeechClient({
  projectId: config.google.projectId,
});

const ENABLED = true;
const NAME = config.gpt3.thirdPartyName;

setInterval(() => {
  // If processing after 30 seconds, shut down process
  if (!state.processing) {
    console.log("===========================");
    console.log("===== SHUTTING DOWN =======");
    console.log("===========================");
    process.exit();
  } else {
    state.processing = false;
  }
}, 45000);

// Load profile
const { profile } = require("./profiles/omega");

// Initialize sound client
const client = new wsrn({
  // On linux e.g. chromePath: "/usr/bin/google-chrome-stable",
  chromePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  continuous: true,
});

const state = {
  processing: true,
  speaking: false,
  thinking: false,
  client,
};

console.log("= APP STARTING =");
state.client.on("ready", () => {
  console.log("SPEECH_TO_TEXT: STARTED");
  state.client.record();
  start();
});

// RESTART PROGRAM?
state.client.on("error", (e) => {
  console.log("Shutdown client and restart", e);
  console.log("STOP CLIENT RECORDING");
  console.log("TRY CLIENT RECORDING");
  if (!state.thinking || !state.speaking) {
    state.client.record();
  }
});

const validateTranscription = (text) => {
  console.log("=== Validate Transcription ===");

  // If english
  const validEnglish = isEnglish(text);
  if (!validEnglish) {
    return false;
  }

  // TODO: if words bigger than 3

  return true;
};

const messageStack = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../messages.json"), "utf8")
);

const start = async () => {
  if (state.speaking) {
    return true;
  }
  console.log("=== OMEGA BOT STARTED ===");
  state.client.on("data", async (transcript) => {
    state.processing = true;
    console.log("=== DETECTED AUDIO ===");
    console.log(transcript);
    console.log("=== DETECTED AUDIO ===");
    const valid = validateTranscription(transcript);

    if (!valid) {
      return true;
    }

    // Figure out which bot personality should reply
    const profile = findProfile(transcript);
    const botName = profile.name;

    try {
      messageStack.push(`${NAME}: ${transcript}`.trim());
      fs.writeFileSync(
        "../messages.json",
        JSON.stringify(messageStack, undefined, 4),
        "utf8"
      );
    } catch (e) {
      console.log(e);
    }

    // Create and read memories (work in progress)
    let memoryStack = [];
    let memoriesStack = [];
    try {
      memoryStack = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, `../memories/${botName.toLowerCase()}.json`),
          "utf8"
        )
      );
    } catch (memoryErr) {
      console.log("====== NO MEMORIES YET FOR ======", botName, memoryErr);
    }
    memoryStack = memoryStack.slice(
      Math.max(memoryStack.length - config.gpt3.maxMemories, 0)
    );
    // TODO - Figure out a better style for  memory classification
    memoriesStack.push(`${botName} likes to talk about: \n`);
    memoryStack.forEach((m) => {
      memoriesStack.push(`- ${m}\n`);
    });
    memoriesStack.push(`\n\n`);

    const defaultPrompt = profile.prompt(
      NAME,
      botName,
      memoriesStack.join("\n")
    );

    // This stack of messages gets appended to the selected bot personality
    const promptStack = [
      ...messageStack.slice(
        Math.max(messageStack.length - config.gpt3.maxMessages, 0)
      ),
    ];

    // This prompts gpt3 to make a reply
    promptStack.push(`${botName}:`);

    const prompt = defaultPrompt + promptStack.join("\n");

    console.log("=== GPT3 PROMPT ===");
    console.log(prompt);
    console.log("=== GPT3 PROMPT ===");

    try {
      // TODO - Is this thinking var required?
      if (!state.thinking) {
        state.thinking = true;
        let responseText = await gpt3(prompt);
        console.log("=== GPT3 RESPONSE ===");
        console.log(responseText);
        console.log("=== GPT3 RESPONSE ===");

        // Auto correct barriers
        if (responseText === "") {
          return true;
        }
        responseText = responseText;
        if (responseText === messageStack[messageStack.length + 1]) {
          return true;
        }

        // Log transcription
        messageStack.push(`${botName}: ${responseText}`);

        // We log messages so the bot stop and start without losing context
        fs.writeFileSync(
          path.join(__dirname, "../messages.json"),
          JSON.stringify(messageStack, undefined, 4),
          "utf8"
        );

        // TODO - This is experimental
        createMemory(
          botName.toLowerCase(),
          messageStack.slice(Math.max(messageStack.length - 5, 0))
        );

        state.thinking = false;

        // Short circuits script for debugging purposes
        if (!ENABLED) {
          return true;
        }
        if (!state.speaking) {
          state.speaking = true;
          state.client.halt();
          delete state.client;
          try {
            var request = {
              input: {
                text: responseText + `, ${botName}, done`,
              },
              ...profile,
            };
            // Talk faster when long gpt3 response
            // if (responseText.length > 140) {
            //   request.audioConfig.speakingRate = 1.1;
            // }
            // if (responseText.length > 340) {
            //   request.audioConfig.speakingRate = 1.3;
            // }
            const [newresponse] = await newclient.synthesizeSpeech(request);
            const writeFile = await util.promisify(fs.writeFile);
            const uid = await uidgen.generate();
            await writeFile(
              path.join(__dirname, `../clips/${uid}.mp3`),
              newresponse.audioContent,
              "binary"
            );
            await sleep(1000);
            const outputPath = path.join(__dirname, `../clips/${uid}.mp3`);
            console.log("outputPath", outputPath);
            // return true;
            player.play(outputPath, async function (err) {
              await sleep(500);
              console.log("Sound played", err);
              delete state.client;
              // todo - this is terrible code. instantiate the client only once in the future
              const aclient = new wsrn({
                chromePath:
                  "C:/Program Files/Google/Chrome/Application/chrome.exe",
                continuous: true,
              });
              state.client = aclient;
              // RESTART PROGRAM?
              state.client.on("error", (e) => {
                console.log("Shutdown client and restart cabllacakkk", e);
                console.log("STOP CLIENT RECORDING");
                console.log("TRY CLIENT RECORDING");
                if (!state.thinking || !state.speaking) {
                  state.client.record();
                }
              });
              state.client.on("ready", () => {
                console.log("SPEECH_TO_TEXT: STARTED");
                state.client.record();
                // todo - remove recursive function
                start();
              });
              await sleep(1000);
            });
            state.speaking = false;
          } catch (speechError) {
            state.speaking = false;
            console.log("Speech failed", speechError);
          }
        }
      }
    } catch (e) {
      console.log(e);
    }
  });
};
