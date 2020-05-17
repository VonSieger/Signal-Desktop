/*global Whisper, $, i18n */

(function() {
  'use strict';
  window.Whisper = window.Whisper || {};

  Whisper.DeviceListRowView = Whisper.View.extend({
    templateName: "deviceListRow",
    initialize(){
      this._outer_render();
    },
    _outer_render(){
      Whisper.View.prototype.render.call(this);
      this.render();
    },
    render(){
      if(!this.model.get('accountManager').isStandaloneDevice()){
        this.$('.tableButton').hide();
      }
    },
    render_attributes(){
      return {
        name: this.model.get('name'),
      };
    },
    events:{
      "click .tableButton": 'onDelete',
    },
    onDelete(){
      const ac = this.model.get('accountManager');
      const promise = ac.removeDevice(this.model.get('id'));
      promise.catch(e => {});
      promise.then(result => {
        this.model.trigger("removeDevice");
      });
    },
  })
})();