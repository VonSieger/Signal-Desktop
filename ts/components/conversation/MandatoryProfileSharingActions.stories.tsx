import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import {
  MandatoryProfileSharingActions,
  Props as MandatoryProfileSharingActionsProps,
} from './MandatoryProfileSharingActions';
import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const getBaseProps = (
  isGroup = false
): MandatoryProfileSharingActionsProps => ({
  i18n,
  conversationType: isGroup ? 'group' : 'direct',
  firstName: text('firstName', 'Cayce'),
  title: isGroup
    ? text('title', 'NYC Rock Climbers')
    : text('title', 'Cayce Bollard'),
  name: isGroup
    ? text('name', 'NYC Rock Climbers')
    : text('name', 'Cayce Bollard'),
  onBlock: action('block'),
  onBlockAndDelete: action('onBlockAndDelete'),
  onDelete: action('delete'),
  onAccept: action('accept'),
});

storiesOf('Components/Conversation/MandatoryProfileSharingActions', module)
  .add('Direct', () => {
    return (
      <div style={{ width: '480px' }}>
        <MandatoryProfileSharingActions {...getBaseProps()} />
      </div>
    );
  })
  .add('Group', () => {
    return (
      <div style={{ width: '480px' }}>
        <MandatoryProfileSharingActions {...getBaseProps(true)} />
      </div>
    );
  });
