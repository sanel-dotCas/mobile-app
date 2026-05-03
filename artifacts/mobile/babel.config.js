module.exports = function (api) {
  api.cache(true);
  const isTest = process.env.NODE_ENV === "test";
  return {
    presets: [
      [
        "babel-preset-expo",
        { unstable_transformImportMeta: isTest ? false : true },
      ],
    ],
  };
};
