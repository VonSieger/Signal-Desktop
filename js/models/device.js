/*Backbone, Whisper*/

(function() {
  'use-strict';

  window.Whisper = window.Whisper || {};

  Whisper.Device = Backbone.Model.extend({
    storeName: 'device',
    defaults(){
      return {
        id: 0,
        name: undefined,
      };
    },
  })
})();
