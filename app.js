////////////////////////////////////// http 테스트
// console.log(axios);

axios
    .get('https://banwonjae.shop:8080/rooms')
    .then(function (response) {
        console.log(response);
    })
    .catch(function (error) {
        console.log(error);
    });

/////////////////////////////////////////////////////////////////////////

const socket = io('https://www.roomescape57.shop:3000/');
console.log(socket);

const myEl = document.getElementById('myEl');
const peer1El = document.getElementById('peer1El');
const muteBtn = document.getElementById('mute');
const micsSelect = document.getElementById('mics');
const speakersSelect = document.getElementById('speakers');

const call = document.getElementById('call');
call.hidden = true;

///////////////////////////////////// media
let myStream;
let peersStream;
let muted = false;
let videoOff = false;
let roomName;
let myPeerConection;

const getMics = async () => {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();

        const mics = devices.filter(device => device.kind === 'audioinput');

        console.log(myStream.getAudioTracks());

        const curMic = myStream.getAudioTracks()[0];

        mics.forEach(mic => {
            const option = document.createElement('option');
            option.value = mic.deviceId;
            option.innerText = mic.label;
            if (curMic.label == mic.label) {
                option.selected = true;
            }
            micsSelect.appendChild(option);
        });
    } catch (e) {
        console.log(e);
    }
};

const getSpeakers = async () => {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();

        const speakers = devices.filter(
            device => device.kind === 'audiooutput'
        );

        const curSpeaker = myStream.getAudioTracks()[0];

        speakers.forEach(speaker => {
            const option = document.createElement('option');
            option.value = speaker.deviceId;
            option.innerText = speaker.label;
            if (curSpeaker.label == speaker.label) {
                option.selected = true;
            }
            speakersSelect.appendChild(option);
        });
    } catch (e) {
        console.log(e);
    }
};

// Attach audio output device to video element using device/sink ID.
function attachSinkId(element, sinkId) {
    if (typeof element.sinkId !== 'undefined') {
        element
            .setSinkId(sinkId)
            .then(() => {
                console.log(`Success, audio output device attached: ${sinkId}`);
            })
            .catch(error => {
                let errorMessage = error;
                if (error.name === 'SecurityError') {
                    errorMessage = `You need to use HTTPS for selecting audio output device: ${error}`;
                }
                console.error(errorMessage);
                // Jump back to first output device in the list as it's the default.
                speakersSelect.selectedIndex = 0;
            });
    } else {
        console.warn('Browser does not support output device selection.');
    }
}

function changeAudioDestination() {
    const audioDestination = speakersSelect.value;

    attachSinkId(peer1El, audioDestination);
}

const getMedia = async deviceId => {
    const initialConstraints = {
        audio: true,
    };

    const constraints = {
        audio: { deviceId: { exact: deviceId } },
    };

    try {
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceId ? constraints : initialConstraints
        );

        myEl.srcObject = myStream;

        if (!deviceId) await (getSpeakers(), getMics());
    } catch (e) {
        console.log(e);
    }
};

const handleMuteClick = () => {
    myStream
        .getAudioTracks()
        .forEach(track => (track.enabled = !track.enabled));

    if (!muted) {
        muteBtn.innerText = 'Unmute';
        muted = true;
    } else {
        muteBtn.innerText = 'Mute';
        muted = false;
    }
};

const handleMicChange = async () => {
    await getMedia(micsSelect.value);
    if (myPeerConection) {
        const audioTrack = myStream.getAudioTracks()[0];
        const audioSander = myPeerConection
            .getSenders()
            .find(sender => sender.track.kind === 'audio');
        audioSander.replaceTrack(audioTrack);
    }
};

muteBtn.addEventListener('click', handleMuteClick);
micsSelect.addEventListener('input', handleMicChange);

///////////////////////////////////// welcome form (join room)

const welcome = document.getElementById('welcome');

welcomeForm = welcome.querySelector('form');

const initCall = async () => {
    welcome.hidden = true;
    call.hidden = false;
    await getMedia();
    makeConnection();
};

const handleWelcomeSubmit = async e => {
    e.preventDefault();
    const input = welcomeForm.querySelector('input');
    await initCall();

    // 방 Id가 들어가면 되겠지
    socket.emit('join_room', input.value);
    roomName = input.value;
    input.value = '';
};

welcomeForm.addEventListener('submit', handleWelcomeSubmit);
speakersSelect.onchange = changeAudioDestination;

///////////////////////////////////// socket code
socket.on('connect', () => {
    console.log('connected!!');
});

// peer 1
socket.on('welcome', async () => {
    const offer = await myPeerConection.createOffer();
    myPeerConection.setLocalDescription(offer);
    console.log('1: offer sent');
    socket.emit('offer', offer, roomName);
});

// peer 2
socket.on('offer', async offer => {
    console.log('2: received the offer');
    myPeerConection.setRemoteDescription(offer);
    const answer = await myPeerConection.createAnswer();
    myPeerConection.setLocalDescription(answer);
    socket.emit('answer', answer, roomName);
    console.log('2: answer sent');
});

// peer 1
socket.on('answer', answer => {
    console.log('1: received the answer');
    myPeerConection.setRemoteDescription(answer);
});

// peer both
socket.on('ice', ice => {
    console.log('received candidate');
    myPeerConection.addIceCandidate(ice);
});

////////////////////////////////////// RTC Code
const handleIce = data => {
    console.log('candidate sent');
    socket.emit('ice', data.candidate, roomName);
};

const handleAddStream = data => {
    console.log(peer1El);
    console.log('peers', data.stream);
    console.log('mine', myStream);
    peer1El.srcObject = data.stream;
};

function makeConnection() {
    myPeerConection = new RTCPeerConnection({
        iceServers: [
            {
                urls: [
                    'stun:stun.l.google.com:19302',
                    'stun:stun1.l.google.com:19302',
                    'stun:stun2.l.google.com:19302',
                    'stun:stun3.l.google.com:19302',
                    'stun:stun4.l.google.com:19302',
                ],
            },
        ],
    });

    myPeerConection.addEventListener('icecandidate', data => {
        handleIce(data);
    });

    myPeerConection.addEventListener('addstream', data => {
        handleAddStream(data);
    });

    myStream
        .getTracks()
        .forEach(track => myPeerConection.addTrack(track, myStream));
}
