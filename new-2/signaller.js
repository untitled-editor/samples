class Signaller {
    /**
     * 
     * @param {*} socketUrl 
     * @param {*} userId 
     * @param {Function} recieveMessage Callback for received messages
     */
    constructor(socketUrl, userId, recieveMessage) {
        this.socketUrl = socketUrl
        this.userId = userId
        this.peer = undefined
        this.candidates = []
        this.recieveMessage = recieveMessage;
        this.ICE_SERVERS = [{
            url: 'stun:stun.l.google.com:19302'
        },
        {
            url: 'turn:turn.bistri.com:80',
            credential: 'homeo',
            username: 'homeo'
        }
        ];

        this.socket = new WebSocket(this.socketUrl);

        this.socket.onmessage = async ({ data }) => {
            // Ignore messages from self
            const message = JSON.parse(data);
            if (message.userId === this.userId) return;
            console.log(message);
            // TODO link users together by checking userIds
            if (message.type === 'broadcast') await this.sendSdpOffer();
            if (message.type === 'sdpOffer') await this.handleSdpOffer(message.sdp);
            if (message.type === 'sdpAnswer') await this.handleSdpAnswer(message.sdp);
            if (message.type === 'iceCandidate') await this.handleIceCandidates(message.candidate)
        }
    }

    sendMessage(message) {
        this.channel.send(message)
    }

    startBroadcasting() {
        const data = {
            userId: this.userId,
            type: 'broadcast'
        }

        return this.socketSend(data);
    }

    async socketSend(data) {
        return this.socket.send(JSON.stringify(data))
    }

    async sendSdpOffer() {
        this.peer = new RTCPeerConnection({ iceServers: this.ICE_SERVERS }, { optional: [{ RtpDataChannels: true }] });

        this.peer.oniceconnectionstatechange = (e) => console.log('qwertyu', e)
        this.peer.onconnectionstatechange = (e) => console.log('zxcvbn', e)

        this.peer.onicecandidate = (event) => {
            console.log('Ice candidate in')
            if (event.candidate) {
                return this.socketSend({
                    userId: this.userId,
                    candidate: event.candidate,
                    type: 'iceCandidate'
                })
            }
        };

        this.channel = this.peer.createDataChannel("chat");
        this.addEventListenersToChannel()

        this.peer.onmessage = ev => console.log(ev)

        const sdp = await this.peer.createOffer()

        await this.peer.setLocalDescription(sdp);

        return this.socketSend({
            userId: this.userId,
            sdp: sdp,
            type: 'sdpOffer'
        });
    }

    async handleSdpOffer(sdp) {
        this.peer = new RTCPeerConnection({ iceServers: this.ICE_SERVERS }, { optional: [{ RtpDataChannels: true }] });

        this.peer.oniceconnectionstatechange = (e) => console.log('qwertyu', e)
        this.peer.onconnectionstatechange = (e) => console.log('qwertyu', e)
        this.peer.ondatachannel = (event) => {
            this.channel = event.channel
            this.addEventListenersToChannel()
        }

        // TODO: remove this ?????
        this.peer.onicecandidate = (event) => {
            console.log(event, 'event')
            if (event.candidate) {
                return this.socketSend({
                    userId: this.userId,
                    candidate: event.candidate,
                    type: 'iceCandidate'
                })
            }
        };

        this.peer.setRemoteDescription(new RTCSessionDescription(sdp));
        const sdpAnswer = await this.peer.createAnswer()
        await this.peer.setLocalDescription(sdpAnswer)
        return this.socketSend({
            userId: this.userId,
            sdp: sdpAnswer,
            type: 'sdpAnswer'
        })
    }

    async handleSdpAnswer(sdp) {
        await this.peer.setRemoteDescription(sdp)
    }

    async addEventListenersToChannel() {
        this.channel.onopen = (event) => {
            console.log('open handle answer')
        }
        this.channel.onmessage = (event) => {
            this.recieveMessage();
            console.log('on message', event.data);
        }
    }

    async handleIceCandidates(candidate) {
        if (this.peer) {
            console.log(candidate);
            this.peer.addIceCandidate(candidate);

            for (var i = 0; i < this.candidates.length; i++) {
                this.peer.addIceCandidate(this.candidates[i]);
            }
            this.candidates = [];
        }
        else this.candidates.push(candidate);
    }
}