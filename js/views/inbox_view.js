/* global
  ConversationController,
  extension,
  getInboxCollection,
  i18n,
  Whisper,
  Signal
*/

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.StickerPackInstallFailedToast = Whisper.ToastView.extend({
    render_attributes() {
      return { toastMessage: i18n('stickers--toast--InstallFailed') };
    },
  });

  Whisper.ConversationStack = Whisper.View.extend({
    className: 'conversation-stack',
    lastConversation: null,
    open(conversation, messageId) {
      const id = `conversation-${conversation.cid}`;
      if (id !== this.el.lastChild.id) {
        const view = new Whisper.ConversationView({
          model: conversation,
          window: this.model.window,
        });
        view.$el.appendTo(this.el);

        if (this.lastConversation) {
          this.lastConversation.trigger(
            'unload',
            'opened another conversation'
          );
        }

        this.lastConversation = conversation;
        conversation.trigger('opened', messageId);
      } else if (messageId) {
        conversation.trigger('scroll-to-message', messageId);
      }

      // Make sure poppers are positioned properly
      window.dispatchEvent(new Event('resize'));
    },
    onUnload(conversationId) {
      if (this.lastConversation.id === conversationId) {
        this.lastConversation = null;
      }
    },
  });

  Whisper.AppLoadingScreen = Whisper.View.extend({
    templateName: 'app-loading-screen',
    className: 'app-loading-screen',
    updateProgress(count) {
      if (count > 0) {
        const message = i18n('loadingMessages', count.toString());
        this.$('.message').text(message);
      }
    },
    render_attributes: {
      message: i18n('loading'),
    },
  });

  Whisper.InboxView = Whisper.View.extend({
    templateName: 'two-column',
    className: 'inbox index',
    initialize(options = {}) {
      this.ready = false;
      this.render();
      this.$el.attr('tabindex', '1');

      this.conversation_stack = new Whisper.ConversationStack({
        el: this.$('.conversation-stack'),
        model: { window: options.window },
      });
      Whisper.events.on('unloadConversation', conversationId => {
        this.conversation_stack.onUnload(conversationId);
      });

      if (!options.initialLoadComplete) {
        this.appLoadingScreen = new Whisper.AppLoadingScreen();
        this.appLoadingScreen.render();
        this.appLoadingScreen.$el.prependTo(this.el);
        this.startConnectionListener();
      } else {
        this.setupLeftPane();
      }

      const inboxCollection = getInboxCollection();

      this.listenTo(inboxCollection, 'messageError', () => {
        if (this.networkStatusView) {
          this.networkStatusView.update();
        }
      });

      this.networkStatusView = new Whisper.NetworkStatusView();
      this.$el
        .find('.network-status-container')
        .append(this.networkStatusView.render().el);

      if (extension.expired()) {
        const banner = new Whisper.ExpiredAlertBanner().render();
        banner.$el.prependTo(this.$el);
        this.$el.addClass('expired');
      }

      Whisper.events.on('pack-install-failed', () => {
        const toast = new Whisper.StickerPackInstallFailedToast();
        toast.$el.appendTo(this.$el);
        toast.render();
      });
    },
    render_attributes: {
      welcomeToSignal: i18n('welcomeToSignal'),
      selectAContact: i18n('selectAContact'),
    },
    events: {
      click: 'onClick',
      keydown: 'hotKey',
    },
    setupLeftPane() {
      if (this.leftPaneView) {
        return;
      }
      this.leftPaneView = new Whisper.ReactWrapperView({
        className: 'left-pane-wrapper',
        JSX: Signal.State.Roots.createLeftPane(window.reduxStore),
      });

      this.$('.left-pane-placeholder').append(this.leftPaneView.el);
    },
    startConnectionListener() {
      this.interval = setInterval(() => {
        const status = window.getSocketStatus();
        switch (status) {
          case WebSocket.CONNECTING:
            break;
          case WebSocket.OPEN:
            clearInterval(this.interval);
            // if we've connected, we can wait for real empty event
            this.interval = null;
            break;
          case WebSocket.CLOSING:
          case WebSocket.CLOSED:
            clearInterval(this.interval);
            this.interval = null;
            // if we failed to connect, we pretend we got an empty event
            this.onEmpty();
            break;
          default:
            // We also replicate empty here
            this.onEmpty();
            break;
        }
      }, 1000);
    },
    onEmpty() {
      this.setupLeftPane();

      const view = this.appLoadingScreen;
      if (view) {
        this.appLoadingScreen = null;
        view.remove();
      }
    },
    onProgress(count) {
      const view = this.appLoadingScreen;
      if (view) {
        view.updateProgress(count);
      }
    },
    focusConversation(e) {
      if (e && this.$(e.target).closest('.placeholder').length) {
        return;
      }

      this.$('#header, .gutter').addClass('inactive');
      this.$('.conversation-stack').removeClass('inactive');
    },
    focusHeader() {
      this.$('.conversation-stack').addClass('inactive');
      this.$('#header, .gutter').removeClass('inactive');
      this.$('.conversation:first .menu').trigger('close');
    },
    reloadBackgroundPage() {
      window.location.reload();
    },
    async openConversation(id, messageId) {
      const conversation = await ConversationController.getOrCreateAndWait(
        id,
        'private'
      );

      const { openConversationExternal } = window.reduxActions.conversations;
      if (openConversationExternal) {
        openConversationExternal(id, messageId);
      }

      this.conversation_stack.open(conversation, messageId);
      this.focusConversation();
    },
    closeRecording(e) {
      if (e && this.$(e.target).closest('.capture-audio').length > 0) {
        return;
      }
      this.$('.conversation:first .recorder').trigger('close');
    },
    onClick(e) {
      this.closeRecording(e);
    },
    hotKey(e){
      const keyCode = e.which || e.keyCode;
      if(!e.altKey){
        return;
      }
      const conversationsAll = Object.values(window.reduxStore.getState()["conversations"]["conversationLookup"]);
      var conversationsSorted = [];
      conversationsAll.forEach(function(element){
        if(element.activeAt != undefined){
          conversationsSorted.push(element);
        }
      });
      conversationsSorted.sort(function(a, b){return b.lastUpdated - a.lastUpdated});
      if(keyCode === 38 || keyCode === 40){//up/down arrow
        this.cycleConversations(keyCode, conversationsSorted);
      }else if(49 <= keyCode && keyCode <= 57){//numbers from 0-9
        this.jumpToConversation(keyCode, conversationsSorted);
      }
    },
    cycleConversations(keyCode, conversationsSorted){
      const activeConversationID = window.reduxStore.getState()["conversations"]["selectedConversation"];
      if(activeConversationID == null){
        if(keyCode === 38){
          this.jumpToConversation(49, conversationsSorted);
        }else if(keyCode === 40){
          this.jumpToConversation(57, conversationsSorted);
        }
        return;
      }
      const activeIndex = conversationsSorted.findIndex(function(element){return element.id == activeConversationID});
      if(keyCode === 38){//up Arrow
        if(activeIndex === 0){
          return;
        }
        this.openConversation(conversationsSorted[activeIndex -1].id, null);
      }else if (keyCode === 40) {//down Arrow
        if(activeIndex >= conversationsSorted.length -1){
          return;
        }
        this.openConversation(conversationsSorted[activeIndex +1].id, null);
      }
    },
    jumpToConversation(keyCode, conversationsSorted){
      var index = keyCode - 49;
      if(index === 8){
        index = conversationsSorted.length -1;
      }
      if(conversationsSorted[index] == null){
        return;
      }
      this.openConversation(conversationsSorted[index].id, null);
    },
  });

  Whisper.ExpiredAlertBanner = Whisper.View.extend({
    templateName: 'expired_alert',
    className: 'expiredAlert clearfix',
    render_attributes() {
      return {
        expiredWarning: i18n('expiredWarning'),
        upgrade: i18n('upgrade'),
      };
    },
  });
})();
