/*global Whisper, $, getAccountManager */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function(){
  'use strict';
  window.Whisper = window.Whisper || {};

  Whisper.AddDeviceView = Whisper.View.extend({
    templateName: 'addDevice',
    className: 'full-screen-flow',
    initialize() {
      this.render();
    },
    events: {
      'click #addDeviceButton': 'onAdd',
      //TODO add validation for input parameters
    },
    onAdd(){
      this.$('.error').hide();
      const accountManager = getAccountManager();
      accountManager.addDevice(decodeURIComponent(this.$('#url .deviceIdentifier')[0].value),
        decodeURIComponent(this.$('#url .deviceKey')[0].value),
      ).catch(e => {
        this.$(".error").text(e.message.split(".")[0]);
        this.$(".error").show();
        throw e;
      });
    }
  })
})();
