/* global
  ConversationController,
  extension,
  getConversations,
  getInboxCollection,
  i18n,
  Whisper,
  textsecure,
  Signal

*/

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.ConversationStack = Whisper.View.extend({
    className: 'conversation-stack',
    open(conversation) {
      const id = `conversation-${conversation.cid}`;
      if (id !== this.el.firstChild.id) {
        this.$el
          .first()
          .find('video, audio')
          .each(function pauseMedia() {
            this.pause();
          });
        let $el = this.$(`#${id}`);
        if ($el === null || $el.length === 0) {
          const view = new Whisper.ConversationView({
            model: conversation,
            window: this.model.window,
          });
          // eslint-disable-next-line prefer-destructuring
          $el = view.$el;
        }
        $el.prependTo(this.el);
      }
      conversation.trigger('opened');
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

      if (!options.initialLoadComplete) {
        this.appLoadingScreen = new Whisper.AppLoadingScreen();
        this.appLoadingScreen.render();
        this.appLoadingScreen.$el.prependTo(this.el);
        this.startConnectionListener();
      }

      const inboxCollection = getInboxCollection();

      this.listenTo(inboxCollection, 'messageError', () => {
        if (this.networkStatusView) {
          this.networkStatusView.render();
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

      this.setupLeftPane();
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
      // Here we set up a full redux store with initial state for our LeftPane Root
      const convoCollection = getConversations();
      const conversations = convoCollection.map(
        conversation => conversation.cachedProps
      );
      const initialState = {
        conversations: {
          conversationLookup: Signal.Util.makeLookup(conversations, 'id'),
        },
        user: {
          regionCode: window.storage.get('regionCode'),
          ourNumber: textsecure.storage.user.getNumber(),
          i18n: window.i18n,
        },
      };

      this.store = Signal.State.createStore(initialState);
      window.inboxStore = this.store;
      this.leftPaneView = new Whisper.ReactWrapperView({
        JSX: Signal.State.Roots.createLeftPane(this.store),
        className: 'left-pane-wrapper',
      });

      // Enables our redux store to be updated by backbone events in the outside world
      const {
        conversationAdded,
        conversationChanged,
        conversationRemoved,
        removeAllConversations,
        messageExpired,
        openConversationExternal,
      } = Signal.State.bindActionCreators(
        Signal.State.Ducks.conversations.actions,
        this.store.dispatch
      );
      const { userChanged } = Signal.State.bindActionCreators(
        Signal.State.Ducks.user.actions,
        this.store.dispatch
      );

      this.openConversationAction = openConversationExternal;

      // In the future this listener will be added by the conversation view itself. But
      //   because we currently have multiple converations open at once, we install just
      //   one global handler.
      // $(document).on('keydown', event => {
      //   const { ctrlKey, key } = event;

      // We can add Command-E as the Mac shortcut when we add it to our Electron menus:
      //   https://stackoverflow.com/questions/27380018/when-cmd-key-is-kept-pressed-keyup-is-not-triggered-for-any-other-key
      // For now, it will stay as CTRL-E only
      //   if (key === 'e' && ctrlKey) {
      //     const state = this.store.getState();
      //     const selectedId = state.conversations.selectedConversation;
      //     const conversation = ConversationController.get(selectedId);

      //     if (conversation && !conversation.get('isArchived')) {
      //       conversation.setArchived(true);
      //       conversation.trigger('unload');
      //     }
      //   }
      // });

      this.listenTo(convoCollection, 'remove', conversation => {
        const { id } = conversation || {};
        conversationRemoved(id);
      });
      this.listenTo(convoCollection, 'add', conversation => {
        const { id, cachedProps } = conversation || {};
        conversationAdded(id, cachedProps);
      });
      this.listenTo(convoCollection, 'change', conversation => {
        const { id, cachedProps } = conversation || {};
        conversationChanged(id, cachedProps);
      });
      this.listenTo(convoCollection, 'reset', removeAllConversations);

      Whisper.events.on('messageExpired', messageExpired);
      Whisper.events.on('userChanged', userChanged);

      // Finally, add it to the DOM
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

      if (this.openConversationAction) {
        this.openConversationAction(id, messageId);
      }

      this.conversation_stack.open(conversation);
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
      const conversationsAll = Object.values(this.store.getState()["conversations"]["conversationLookup"]);
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
      const activeConversationID = this.store.getState()["conversations"]["selectedConversation"];
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
