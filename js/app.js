var domready = Rx.Observable.fromPromise($(document).ready().promise());
var CreateTokboxApp = function() {
    var App = {
        apiKey : null,
        sessionId : null,
        token : null,
        session : null, //Tokbox session
        extensionId : '', //Only for Chrome
        loginStream : new Rx.Subject(), //Just to check the app login
        onStreamCreated : null //Wrapping session."on stream created" event.
    };

    /**
     * Login function
     * @return Observable
     */
    App.doLogin = function () {
        console.log('Logging in...');
        var promise = $.get('https://opentoksvr.herokuapp.com/session').promise();
        var ajaxSource =  Rx.Observable.fromPromise(promise);
        ajaxSource.subscribe(function(data){
            //Filling session vars
            App.apiKey = data.apiKey;
            App.sessionId = data.sessionId;
            App.token = data.token;
            App.session = OT.initSession(App.apiKey, App.sessionId);
            //Creating onScreamCreated observable
            App.onStreamCreated = Rx.Observable.fromEventPattern(
                function add (h) {
                    App.session.on('streamCreated', h);
                }
            );
            App.loginStream.onNext(data);
            App.loginStream.onCompleted();
            console.log('Login completed');
        }, function (err) {
            console.log('Login error');
        });
        return ajaxSource; //just if needed, but loginStream does the job
    };


    /**
     * If you're using Google Chrome, first make sure you have defined the Chrome extension Id properly.
     * Example: app.extensionId = 'knkhmjijhhlfnajamnbbamlopaniehna'; app.init();
     */
    App.init = function () {

        // For Google Chrome only, register your extension by ID,
        // You can find it at chrome://extensions once the extension is installed
        OT.registerScreenSharingExtension('chrome', App.extensionId, 2);

        App.doLogin();

        App.loginStream.subscribe(function(data){

            //Capturing streams from another publisher
            App.onStreamCreated.subscribe(
                function(event){
                    if (event.stream.videoType === 'screen') {
                        // This is a screen-sharing stream published by another client
                        var subOptions = {
                            width: event.stream.videoDimensions.width / 1.85,
                            height: event.stream.videoDimensions.height /1.85
                        };
                        App.session.subscribe(event.stream, 'screen-subscriber', subOptions);
                    } else {
                        console.log('event.stream.videoType != screen');
                    }
                },
                function (err) {
                    console.log('Stream error');
                },
                function () {
                    console.log('Stream completed');
                }
            );


            //Connecting and publishing the user's screen
            App.session.connect(App.token, function(error) {
                console.log('Connected');
                OT.checkScreenSharingCapability(function(response) {
                    if (!response.supported || response.extensionRegistered === false) {
                        alert('This browser does not support screen sharing.');
                    } else if (response.extensionInstalled === false) {
                        alert('Please install the screen sharing extension and load this page over HTTPS.');
                    } else {
                        // Screen sharing is available. Publish the screen.
                        // Create an element, but do not display it in the HTML DOM:
                        var screenContainerElement = document.createElement('div');
                        var screenSharingPublisher = OT.initPublisher(
                            screenContainerElement,
                            { videoSource : 'screen' },
                            function(error) {
                                if (error) {
                                    alert('Something went wrong: ' + error.message);
                                } else {
                                    App.session.publish(
                                        screenSharingPublisher,
                                        function(error) {
                                            if (error) {
                                                alert('Something went wrong: ' + error.message);
                                            }
                                        });
                                }
                            });
                    }
                });

            });
        });

    };
    return App;
};


var app;
var onStart;
var startbtn = $('#startbtn');
var extensionId = $('#extensionId');
domready.subscribe(function() {
    console.log('DOM ready');
    startbtn.show();
    onStart = Rx.Observable.fromEvent(startbtn,'click');
    onStart.subscribe(function(e){
        app = CreateTokboxApp();
        app.extensionId = extensionId.val();
        app.init();
        app.loginStream.subscribe(function(d){
            startbtn.hide();
        });
    });
});










