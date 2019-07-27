import { connect } from 'react-redux';
import { createSelector } from 'reselect';
import { get } from 'lodash';
import { mapDispatchToProps } from '../actions';
import { EmojiButton, Props } from '../../components/emoji/EmojiButton';
import { StateType } from '../reducer';

import { isShortName } from '../../components/emoji/lib';
import { getIntl } from '../selectors/user';

const selectRecentEmojis = createSelector(
  ({ emojis }: StateType) => emojis.recents,
  recents => recents.filter(isShortName)
);

const mapStateToProps = (state: StateType) => {
  return {
    i18n: getIntl(state),
    recentEmojis: selectRecentEmojis(state),
    skinTone: get(state, ['items', 'skinTone'], 0),
  };
};

const dispatchPropsMap = {
  ...mapDispatchToProps,
  onSetSkinTone: (tone: number) => mapDispatchToProps.putItem('skinTone', tone),
};

type OnPickEmojiType = Props['onPickEmoji'];
type UseEmojiType = typeof mapDispatchToProps.useEmoji;

export type OwnProps = {
  onPickEmoji: OnPickEmojiType;
};

const selectOnPickEmoji = createSelector(
  (onPickEmoji: OnPickEmojiType) => onPickEmoji,
  (_onPickEmoji: OnPickEmojiType, useEmoji: UseEmojiType) => useEmoji,
  (onPickEmoji, useEmoji): OnPickEmojiType => e => {
    onPickEmoji(e);
    useEmoji(e.shortName);
  }
);

const mergeProps = (
  stateProps: ReturnType<typeof mapStateToProps>,
  dispatchProps: typeof dispatchPropsMap,
  ownProps: OwnProps
) => ({
  ...ownProps,
  ...stateProps,
  ...dispatchProps,
  onPickEmoji: selectOnPickEmoji(ownProps.onPickEmoji, dispatchProps.useEmoji),
});

const smart = connect(mapStateToProps, dispatchPropsMap, mergeProps);

export const SmartEmojiButton = smart(EmojiButton);
