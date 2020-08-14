/* global libsignal, textsecure */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  function ProvisioningCipher() {}

  ProvisioningCipher.prototype = {
    decrypt(provisionEnvelope) {
      const masterEphemeral = provisionEnvelope.publicKey.toArrayBuffer();
      const message = provisionEnvelope.body.toArrayBuffer();
      if (new Uint8Array(message)[0] !== 1) {
        throw new Error('Bad version number on ProvisioningMessage');
      }

      const iv = message.slice(1, 16 + 1);
      const mac = message.slice(message.byteLength - 32, message.byteLength);
      const ivAndCiphertext = message.slice(0, message.byteLength - 32);
      const ciphertext = message.slice(16 + 1, message.byteLength - 32);

      return libsignal.Curve.async
        .calculateAgreement(masterEphemeral, this.keyPair.privKey)
        .then(ecRes =>
          libsignal.HKDF.deriveSecrets(
            ecRes,
            new ArrayBuffer(32),
            'TextSecure Provisioning Message'
          )
        )
        .then(keys =>
          libsignal.crypto
            .verifyMAC(ivAndCiphertext, keys[1], mac, 32)
            .then(() => libsignal.crypto.decrypt(keys[0], ciphertext, iv))
        )
        .then(plaintext => {
          const provisionMessage = textsecure.protobuf.ProvisionMessage.decode(
            plaintext
          );
          const privKey = provisionMessage.identityKeyPrivate.toArrayBuffer();

          return libsignal.Curve.async.createKeyPair(privKey).then(keyPair => {
            const ret = {
              identityKeyPair: keyPair,
              number: provisionMessage.number,
              provisioningCode: provisionMessage.provisioningCode,
              userAgent: provisionMessage.userAgent,
              readReceipts: provisionMessage.readReceipts,
            };
            if (provisionMessage.profileKey) {
              ret.profileKey = provisionMessage.profileKey.toArrayBuffer();
            }
            return ret;
          });
        });
    },
    encrypt(provisionMessage, publicKey) {
      return this.getPrivateKey().then(privKey => {
        const plainText = provisionMessage.toArrayBuffer();
        const masterEphemeral = publicKey;

        return libsignal.Curve.async
          .calculateAgreement(masterEphemeral, privKey)
          .then(sharedSecret => {
            return libsignal.HKDF.deriveSecrets(
              sharedSecret,
              new ArrayBuffer(32),
              'TextSecure Provisioning Message'
            ).then(derivedSecret => {
              const derivedSecretSplit = [
                derivedSecret.slice(0, 33),
                derivedSecret.slice(33, 65),
              ];

              const version = Uint8Array.from([1]).buffer;
              const iv = libsignal.crypto.getRandomBytes(16);
              return libsignal.crypto
                .encrypt(derivedSecret[0], plainText, iv)
                .then(cypherText => {
                  cypherText = this._appendBuffer(iv, cypherText);
                  return libsignal.crypto
                    .calculateMAC(
                      derivedSecret[1],
                      this._appendBuffer(version, cypherText)
                    )
                    .then(mac => {
                      const body = this._appendBuffer(
                        this._appendBuffer(version, cypherText),
                        mac
                      );

                      const provisionEnvelope = new textsecure.protobuf.ProvisionEnvelope();

                      return this.getPublicKey().then(ownPubKey => {
                        return new textsecure.protobuf.ProvisionEnvelope({
                          publicKey: new Uint8Array(ownPubKey),
                          body: new Uint8Array(body),
                        });
                      });
                    });
                });
            });
          });
      });
    },
    getPublicKey() {
      return Promise.resolve()
        .then(() => {
          if (!this.keyPair) {
            return libsignal.Curve.async.generateKeyPair().then(keyPair => {
              this.keyPair = keyPair;
            });
          }

          return null;
        })
        .then(() => this.keyPair.pubKey);
    },
    getPrivateKey() {
      return Promise.resolve()
        .then(() => {
          if (!this.keyPair) {
            return libsignal.Curve.async.generateKeyPair().then(keyPair => {
              this.keyPair = keyPair;
            });
          }

          return null;
        })
        .then(() => this.keyPair.privKey);
    },
    _appendBuffer(buffer1, buffer2) {
      var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
      tmp.set(new Uint8Array(buffer1), 0);
      tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
      return tmp.buffer;
    },
  };

  libsignal.ProvisioningCipher = function ProvisioningCipherWrapper() {
    const cipher = new ProvisioningCipher();

    this.decrypt = cipher.decrypt.bind(cipher);
    this.getPublicKey = cipher.getPublicKey.bind(cipher);
    this.encrypt = cipher.encrypt.bind(cipher);
  };
})();
