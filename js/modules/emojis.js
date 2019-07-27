const { take } = require('lodash');
const { getRecentEmojis } = require('./data');
const {
  replaceColons,
  hasVariation,
} = require('../../ts/components/emoji/lib');

module.exports = {
  getInitialState,
  load,
  replaceColons,
  hasVariation,
};

let initialState = null;

async function load() {
  const recents = await getRecentEmojisForRedux();

  initialState = {
    recents: take(recents, 32),
  };
}

async function getRecentEmojisForRedux() {
  const recent = await getRecentEmojis();
  return recent.map(e => e.shortName);
}

function getInitialState() {
  return initialState;
}
