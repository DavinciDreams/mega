module.exports = {
  gpt3: {
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0.87,
    thirdPartyName: "People",
    maxMessages: 6,
    maxMemories: 5,
  },
  maxMessages: 6,
  google: {
    projectId: "jsonresume-registry",
  },
};
