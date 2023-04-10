const notyf = new Notyf({
    position: { x: "center", y: "top" },
    types: [
        {
            type: "success",
            background: "#99c959",
            duration: 2000,
        },
        {
            type: "error",
            background: "#e15b64",
            duration: 3000,
        },
    ],
});
window.addEventListener("mousedown", (event) => {
    if (event.target.className === "toggler") {
        document.body.classList.toggle("show-nav");
    } else if (event.target.className === "overlay") {
        document.body.classList.remove("show-nav");
    } else if (event.target === document.body) {
        document.body.classList.remove("show-nav");
    }
});
const messagsEle = document.getElementsByClassName("messages")[0];
const chatlog = document.getElementById("chatlog");
const stopEle = document.getElementById("stopChat");
const sendBtnEle = document.getElementById("sendbutton");
const textarea = document.getElementById("chatinput");
const settingEle = document.getElementById("setting");
const dialogEle = document.getElementById("setDialog");
const systemEle = document.getElementById("systemInput");
const speechServiceEle = document.getElementById("preSetService");
const newChatEle = document.getElementById("newChat");
const chatListEle = document.getElementById("chatList");
const voiceRecEle = document.getElementById("voiceRecIcon");
const voiceRecSetEle = document.getElementById("voiceRecSetting");
let voiceType = 1; // 设置 0: 提问语音，1：回答语音
let voiceRole = []; // 语音
let voiceVolume = []; //音量
let voiceRate = []; // 语速
let voicePitch = []; // 音调
let enableContVoice; // 连续朗读
let enableAutoVoice; // 自动朗读
let existVoice = 2; // 3:Azure语音 2:使用edge在线语音, 1:使用本地语音, 0:不支持语音
let azureToken;
let azureTokenTimer;
let azureRegion;
let azureKey;
let azureRole = [];
let azureStyle = [];
let isSafeEnv =
    location.hostname.match(/127.|localhost/) ||
    location.protocol.match(/https:|file:/); // https或本地安全环境
let supportRec = !!window.webkitSpeechRecognition && isSafeEnv; // 是否支持语音识别输入
let recing = false;
let toggleRecEv;
textarea.focus();
const textInputEvent = () => {
    if (!loading) {
        if (textarea.value.trim().length) {
            sendBtnEle.classList.add("activeSendBtn");
        } else {
            sendBtnEle.classList.remove("activeSendBtn");
        }
    }
    textarea.style.height = "47px";
    textarea.style.height = textarea.scrollHeight + "px";
};
textarea.oninput = textInputEvent;
if (supportRec) {
    noRecTip.style.display = "none";
    yesRec.style.display = "block";
    document.getElementById("voiceRec").style.display = "block";
    textarea.classList.add("message_if_voice");
    let langs = [
        // from https://www.google.com/intl/en/chrome/demos/speech.html
        [
            "中文",
            ["cmn-Hans-CN", "普通话 (大陆)"],
            ["cmn-Hans-HK", "普通话 (香港)"],
            ["cmn-Hant-TW", "中文 (台灣)"],
            ["yue-Hant-HK", "粵語 (香港)"],
        ],
        [
            "English",
            ["en-US", "United States"],
            ["en-GB", "United Kingdom"],
            ["en-AU", "Australia"],
            ["en-CA", "Canada"],
            ["en-IN", "India"],
            ["en-KE", "Kenya"],
            ["en-TZ", "Tanzania"],
            ["en-GH", "Ghana"],
            ["en-NZ", "New Zealand"],
            ["en-NG", "Nigeria"],
            ["en-ZA", "South Africa"],
            ["en-PH", "Philippines"],
        ],
    ];
    langs.forEach((lang, i) => {
        select_language.options.add(new Option(lang[0], i));
        selectLangOption.options.add(new Option(lang[0], i));
    });
    const updateCountry = function () {
        selectLangOption.selectedIndex = select_language.selectedIndex =
            this.selectedIndex;
        select_dialect.innerHTML = "";
        selectDiaOption.innerHTML = "";
        let list = langs[select_language.selectedIndex];
        for (let i = 1; i < list.length; i++) {
            select_dialect.options.add(new Option(list[i][1], list[i][0]));
            selectDiaOption.options.add(new Option(list[i][1], list[i][0]));
        }
        select_dialect.style.visibility =
            list[1].length == 1 ? "hidden" : "visible";
        selectDiaOption.parentElement.style.visibility =
            list[1].length == 1 ? "hidden" : "visible";
        localStorage.setItem("voiceRecLang", select_dialect.value);
    };
    let localLangIdx = 0;
    let localDiaIdx = 0;
    let localRecLang = localStorage.getItem("voiceRecLang");
    if (localRecLang) {
        let localIndex = langs.findIndex((item) => {
            let diaIdx = item.findIndex((lang) => {
                return lang instanceof Array && lang[0] === localRecLang;
            });
            if (diaIdx !== -1) {
                localDiaIdx = diaIdx - 1;
                return true;
            }
            return false;
        });
        if (localIndex !== -1) {
            localLangIdx = localIndex;
        }
    }
    selectLangOption.onchange = updateCountry;
    select_language.onchange = updateCountry;
    selectDiaOption.onchange = select_dialect.onchange = function () {
        selectDiaOption.selectedIndex = select_dialect.selectedIndex =
            this.selectedIndex;
        localStorage.setItem("voiceRecLang", select_dialect.value);
    };
    selectLangOption.selectedIndex = select_language.selectedIndex = localLangIdx;
    select_language.dispatchEvent(new Event("change"));
    selectDiaOption.selectedIndex = select_dialect.selectedIndex = localDiaIdx;
    select_dialect.dispatchEvent(new Event("change"));
    let recIns = new webkitSpeechRecognition();
    // prevent some Android bug
    recIns.continuous = !/\bAndroid\b/i.test(navigator.userAgent);
    recIns.interimResults = true;
    recIns.maxAlternatives = 1;
    let recRes = (tempRes = "");
    let oriRes;
    const resEvent = (event) => {
        if (typeof event.results === "undefined") {
            toggleRecEvent();
            return;
        }
        let isFinal;
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            isFinal = event.results[i].isFinal;
            if (isFinal) {
                recRes += event.results[i][0].transcript;
            } else {
                tempRes = recRes + event.results[i][0].transcript;
            }
        }
        textarea.value = oriRes + (isFinal ? recRes : tempRes);
        textInputEvent();
        textarea.focus();
    };
    const endEvent = (event) => {
        if (!(event && event.type === "end")) {
            recIns.stop();
        }
        recIns.onresult = null;
        recIns.onerror = null;
        recIns.onend = null;
        recRes = tempRes = "";
        voiceRecEle.classList.remove("voiceRecing");
        recing = false;
    };
    const errorEvent = (ev) => {
        if (event.error === "no-speech") {
            notyf.error("未识别到语音，请调整设备后重试！");
        }
        if (event.error === "audio-capture") {
            notyf.error("未找到麦克风，请确保已安装麦克风！");
        }
        if (event.error === "not-allowed") {
            notyf.error("未允许使用麦克风的权限！");
        }
        endEvent();
    };
    const closeEvent = (ev) => {
        if (voiceRecSetEle.contains(ev.target)) return;
        if (!voiceRecSetEle.contains(ev.target)) {
            voiceRecSetEle.style.display = "none";
            document.removeEventListener("mousedown", closeEvent, true);
            voiceRecEle.classList.remove("voiceLong");
        }
    };
    const longEvent = () => {
        voiceRecSetEle.style.display = "block";
        document.addEventListener("mousedown", closeEvent, true);
    };
    const toggleRecEvent = () => {
        voiceRecEle.classList.toggle("voiceRecing");
        if (voiceRecEle.classList.contains("voiceRecing")) {
            try {
                oriRes = textarea.value;
                recIns.lang = select_dialect.value;
                recIns.start();
                recIns.onresult = resEvent;
                recIns.onerror = errorEvent;
                recIns.onend = endEvent;
                recing = true;
            } catch (e) {
                endEvent();
            }
        } else {
            endEvent();
        }
    };
    toggleRecEv = toggleRecEvent;
    let timer;
    const voiceDownEvent = (ev) => {
        ev.preventDefault();
        let i = 0;
        voiceRecEle.classList.add("voiceLong");
        timer = setInterval(() => {
            i += 1;
            if (i >= 3) {
                clearInterval(timer);
                timer = void 0;
                longEvent();
            }
        }, 100);
    };
    const voiceUpEvent = (ev) => {
        ev.preventDefault();
        if (timer !== void 0) {
            toggleRecEvent();
            clearInterval(timer);
            timer = void 0;
            voiceRecEle.classList.remove("voiceLong");
        }
    };
    voiceRecEle.addEventListener("mousedown", voiceDownEvent);
    voiceRecEle.addEventListener("touchstart", voiceDownEvent);
    voiceRecEle.addEventListener("mouseup", voiceUpEvent);
    voiceRecEle.addEventListener("touchend", voiceUpEvent);
}
document.getElementsByClassName("setSwitch")[0].onclick = function (ev) {
    let activeEle = this.getElementsByClassName("activeSwitch")[0];
    if (ev.target !== activeEle) {
        activeEle.classList.remove("activeSwitch");
        ev.target.classList.add("activeSwitch");
        document.getElementById(ev.target.dataset.id).style.display = "block";
        document.getElementById(activeEle.dataset.id).style.display = "none";
    }
};
let localVoiceType = localStorage.getItem("existVoice");
if (localVoiceType) {
    existVoice = parseInt(localVoiceType);
    speechServiceEle.value = existVoice;
}
if (!(window.speechSynthesis && window.SpeechSynthesisUtterance)) {
    speechServiceEle.remove(2);
}
const clearAzureVoice = () => {
    azureKey = void 0;
    azureRegion = void 0;
    document.getElementById("azureExtra").style.display = "none";
    azureKeyInput.parentElement.style.display = "none";
    preSetAzureRegion.parentElement.style.display = "none";
    if (azureTokenTimer) {
        clearInterval(azureTokenTimer);
        azureTokenTimer = void 0;
    }
};
speechServiceEle.onchange = () => {
    existVoice = parseInt(speechServiceEle.value);
    localStorage.setItem("existVoice", existVoice);
    toggleVoiceCheck(true);
    if (checkAzureAbort && !checkAzureAbort.signal.aborted) {
        checkAzureAbort.abort();
        checkAzureAbort = void 0;
    }
    if (checkEdgeAbort && !checkEdgeAbort.signal.aborted) {
        checkEdgeAbort.abort();
        checkEdgeAbort = void 0;
    }
    if (existVoice === 3) {
        azureKeyInput.parentElement.style.display = "block";
        preSetAzureRegion.parentElement.style.display = "block";
        loadAzureVoice();
    } else if (existVoice === 2) {
        clearAzureVoice();
        loadEdgeVoice();
    } else if (existVoice === 1) {
        toggleVoiceCheck(false);
        clearAzureVoice();
        loadLocalVoice();
    }
};
let azureVoiceData,
    edgeVoiceData,
    systemVoiceData,
    checkAzureAbort,
    checkEdgeAbort;
const toggleVoiceCheck = (bool) => {
    checkVoiceLoad.style.display = bool ? "flex" : "none";
    speechDetail.style.display = bool ? "none" : "block";
};
const loadAzureVoice = () => {
    let checking = false;
    checkVoiceLoad.onclick = () => {
        if (checking) return;
        if (azureKey) {
            checking = true;
            checkVoiceLoad.classList.add("voiceChecking");
            if (azureTokenTimer) {
                clearInterval(azureTokenTimer);
            }
            checkAzureAbort = new AbortController();
            setTimeout(() => {
                if (checkAzureAbort && !checkAzureAbort.signal.aborted) {
                    checkAzureAbort.abort();
                    checkAzureAbort = void 0;
                }
            }, 15000);
            Promise.all([
                getAzureToken(checkAzureAbort.signal),
                getVoiceList(checkAzureAbort.signal),
            ])
                .then(() => {
                    azureTokenTimer = setInterval(() => {
                        getAzureToken();
                    }, 540000);
                    toggleVoiceCheck(false);
                })
                .catch((e) => { })
                .finally(() => {
                    checkVoiceLoad.classList.remove("voiceChecking");
                    checking = false;
                });
        }
    };
    const getAzureToken = (signal) => {
        return new Promise((res, rej) => {
            fetch(
                "https://" +
                azureRegion +
                ".api.cognitive.microsoft.com/sts/v1.0/issueToken",
                {
                    signal,
                    method: "POST",
                    headers: {
                        "Ocp-Apim-Subscription-Key": azureKey,
                    },
                }
            )
                .then((response) => {
                    response.text().then((text) => {
                        try {
                            let json = JSON.parse(text);
                            notyf.error("由于订阅密钥无效或 API 端点错误，访问被拒绝！");
                            rej();
                        } catch (e) {
                            azureToken = text;
                            res();
                        }
                    });
                })
                .catch((e) => {
                    rej();
                });
        });
    };
    const getVoiceList = (signal) => {
        return new Promise((res, rej) => {
            if (azureVoiceData) {
                initVoiceSetting(azureVoiceData);
                res();
            } else {
                let localAzureVoiceData = localStorage.getItem(
                    azureRegion + "voiceData"
                );
                if (localAzureVoiceData) {
                    azureVoiceData = JSON.parse(localAzureVoiceData);
                    initVoiceSetting(azureVoiceData);
                    res();
                } else {
                    fetch(
                        "https://" +
                        azureRegion +
                        ".tts.speech.microsoft.com/cognitiveservices/voices/list",
                        {
                            signal,
                            headers: {
                                "Ocp-Apim-Subscription-Key": azureKey,
                            },
                        }
                    )
                        .then((response) => {
                            response
                                .json()
                                .then((json) => {
                                    azureVoiceData = json;
                                    localStorage.setItem(
                                        azureRegion + "voiceData",
                                        JSON.stringify(json)
                                    );
                                    initVoiceSetting(json);
                                    res();
                                })
                                .catch((e) => {
                                    notyf.error("由于订阅密钥无效或 API 端点错误，访问被拒绝！");
                                    rej();
                                });
                        })
                        .catch((e) => {
                            rej();
                        });
                }
            }
        });
    };
    let azureRegionEle = document.getElementById("preSetAzureRegion");
    if (!azureRegionEle.options.length) {
        const azureRegions = [
            "southafricanorth",
            "eastasia",
            "southeastasia",
            "australiaeast",
            "centralindia",
            "japaneast",
            "japanwest",
            "koreacentral",
            "canadacentral",
            "northeurope",
            "westeurope",
            "francecentral",
            "germanywestcentral",
            "norwayeast",
            "switzerlandnorth",
            "switzerlandwest",
            "uksouth",
            "uaenorth",
            "brazilsouth",
            "centralus",
            "eastus",
            "eastus2",
            "northcentralus",
            "southcentralus",
            "westcentralus",
            "westus",
            "westus2",
            "westus3",
        ];
        azureRegions.forEach((region, i) => {
            let option = document.createElement("option");
            option.value = region;
            option.text = region;
            azureRegionEle.options.add(option);
        });
    }
    let localAzureRegion = localStorage.getItem("azureRegion");
    if (localAzureRegion) {
        azureRegion = localAzureRegion;
        azureRegionEle.value = localAzureRegion;
    }
    azureRegionEle.onchange = () => {
        azureRegion = azureRegionEle.value;
        localStorage.setItem("azureRegion", azureRegion);
        toggleVoiceCheck(true);
    };
    azureRegionEle.dispatchEvent(new Event("change"));
    let azureKeyEle = document.getElementById("azureKeyInput");
    let localAzureKey = localStorage.getItem("azureKey");
    if (localAzureKey) {
        azureKey = localAzureKey;
        azureKeyEle.value = localAzureKey;
    }
    azureKeyEle.onchange = () => {
        azureKey = azureKeyEle.value;
        localStorage.setItem("azureKey", azureKey);
        toggleVoiceCheck(true);
    };
    azureKeyEle.dispatchEvent(new Event("change"));
    if (azureKey) {
        checkVoiceLoad.dispatchEvent(new Event("click"));
    }
};
const loadEdgeVoice = () => {
    let checking = false;
    checkVoiceLoad.onclick = () => {
        if (checking) return;
        checking = true;
        checkVoiceLoad.classList.add("voiceChecking");
        if (edgeVoiceData) {
            initVoiceSetting(edgeVoiceData);
            toggleVoiceCheck(false);
            checkVoiceLoad.classList.remove("voiceChecking");
        } else {
            checkEdgeAbort = new AbortController();
            setTimeout(() => {
                if (checkEdgeAbort && !checkEdgeAbort.signal.aborted) {
                    checkEdgeAbort.abort();
                    checkEdgeAbort = void 0;
                }
            }, 10000);
            fetch(
                "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4",
                { signal: checkEdgeAbort.signal }
            )
                .then((response) => {
                    response.json().then((json) => {
                        edgeVoiceData = json;
                        toggleVoiceCheck(false);
                        initVoiceSetting(json);
                    });
                })
                .catch((err) => { })
                .finally(() => {
                    checkVoiceLoad.classList.remove("voiceChecking");
                    checking = false;
                });
        }
    };
    checkVoiceLoad.dispatchEvent(new Event("click"));
};
const loadLocalVoice = () => {
    if (systemVoiceData) {
        initVoiceSetting(systemVoiceData);
    } else {
        let initedVoice = false;
        const getLocalVoice = () => {
            let voices = speechSynthesis.getVoices();
            if (voices.length) {
                if (!initedVoice) {
                    initedVoice = true;
                    systemVoiceData = voices;
                    initVoiceSetting(voices);
                }
                return true;
            } else {
                return false;
            }
        };
        let syncExist = getLocalVoice();
        if (!syncExist) {
            if ("onvoiceschanged" in speechSynthesis) {
                speechSynthesis.onvoiceschanged = () => {
                    getLocalVoice();
                };
            } else if (speechSynthesis.addEventListener) {
                speechSynthesis.addEventListener("voiceschanged", () => {
                    getLocalVoice();
                });
            }
            let timeout = 0;
            let timer = setInterval(() => {
                if (getLocalVoice() || timeout > 1000) {
                    if (timeout > 1000) {
                        existVoice = 0;
                    }
                    clearInterval(timer);
                    timer = null;
                }
                timeout += 300;
            }, 300);
        }
    }
};
const initVoiceSetting = (voices) => {
    let isOnline = existVoice >= 2;
    let voicesEle = document.getElementById("preSetSpeech");
    // 支持中文和英文
    voices = isOnline
        ? voices.filter((item) => item.Locale.match(/^(zh-|en-)/))
        : voices.filter((item) => item.lang.match(/^(zh-|en-)/));
    if (isOnline) {
        voices.map((item) => {
            item.name =
                item.FriendlyName ||
                `${item.DisplayName} Online (${item.VoiceType}) - ${item.LocaleName}`;
            item.lang = item.Locale;
        });
    }
    voices.sort((a, b) => {
        if (a.lang.slice(0, 2) === b.lang.slice(0, 2)) return 0;
        return a.lang < b.lang ? 1 : -1; // 中文在前"z"
    });
    voices.map((item) => {
        if (item.name.match(/^(Google |Microsoft )/)) {
            item.displayName = item.name.replace(/^.*? /, "");
        } else {
            item.displayName = item.name;
        }
    });
    voicesEle.innerHTML = "";
    voices.forEach((voice, i) => {
        let option = document.createElement("option");
        option.value = i;
        option.text = voice.displayName;
        voicesEle.options.add(option);
    });
    voicesEle.onchange = () => {
        voiceRole[voiceType] = voices[voicesEle.value];
        localStorage.setItem("voice" + voiceType, voiceRole[voiceType].name);
        if (voiceRole[voiceType].StyleList || voiceRole[voiceType].RolePlayList) {
            document.getElementById("azureExtra").style.display = "block";
            let voiceStyles = voiceRole[voiceType].StyleList;
            let voiceRoles = voiceRole[voiceType].RolePlayList;
            if (voiceRoles) {
                preSetVoiceRole.innerHTML = "";
                voiceRoles.forEach((role, i) => {
                    let option = document.createElement("option");
                    option.value = role;
                    option.text = role;
                    preSetVoiceRole.options.add(option);
                });
                let localRole = localStorage.getItem("azureRole" + voiceType);
                if (localRole && voiceRoles.indexOf(localRole) !== -1) {
                    preSetVoiceRole.value = localRole;
                    azureRole[voiceType] = localRole;
                } else {
                    preSetVoiceRole.selectedIndex = 0;
                    azureRole[voiceType] = voiceRole[0];
                }
                preSetVoiceRole.onchange = () => {
                    azureRole[voiceType] = preSetVoiceRole.value;
                    localStorage.setItem("azureRole" + voiceType, preSetVoiceRole.value);
                };
                preSetVoiceRole.dispatchEvent(new Event("change"));
            } else {
                azureRole[voiceType] = void 0;
                localStorage.removeItem("azureRole" + voiceType);
            }
            preSetVoiceRole.style.display = voiceRoles ? "block" : "none";
            preSetVoiceRole.previousElementSibling.style.display = voiceRoles
                ? "block"
                : "none";
            if (voiceStyles) {
                preSetVoiceStyle.innerHTML = "";
                voiceStyles.forEach((style, i) => {
                    let option = document.createElement("option");
                    option.value = style;
                    option.text = style;
                    preSetVoiceStyle.options.add(option);
                });
                let localStyle = localStorage.getItem("azureStyle" + voiceType);
                if (localStyle && voiceStyles.indexOf(localStyle) !== -1) {
                    preSetVoiceStyle.value = localStyle;
                    azureStyle[voiceType] = localStyle;
                } else {
                    preSetVoiceStyle.selectedIndex = 0;
                    azureStyle[voiceType] = voiceStyles[0];
                }
                preSetVoiceStyle.onchange = () => {
                    azureStyle[voiceType] = preSetVoiceStyle.value;
                    localStorage.setItem(
                        "azureStyle" + voiceType,
                        preSetVoiceStyle.value
                    );
                };
                preSetVoiceStyle.dispatchEvent(new Event("change"));
            } else {
                azureStyle[voiceType] = void 0;
                localStorage.removeItem("azureStyle" + voiceType);
            }
            preSetVoiceStyle.style.display = voiceStyles ? "block" : "none";
            preSetVoiceStyle.previousElementSibling.style.display = voiceStyles
                ? "block"
                : "none";
        } else {
            document.getElementById("azureExtra").style.display = "none";
            azureRole[voiceType] = void 0;
            localStorage.removeItem("azureRole" + voiceType);
            azureStyle[voiceType] = void 0;
            localStorage.removeItem("azureStyle" + voiceType);
        }
    };
    const loadAnother = (type) => {
        type = type ^ 1;
        let localVoice = localStorage.getItem("voice" + type);
        if (localVoice) {
            let localIndex = voices.findIndex((item) => {
                return item.name === localVoice;
            });
            if (localIndex === -1) localIndex = 0;
            voiceRole[type] = voices[localIndex];
        } else {
            voiceRole[type] = voices[0];
        }
        if (existVoice === 3) {
            let localStyle = localStorage.getItem("azureStyle" + type);
            azureStyle[type] = localStyle ? localStyle : void 0;
            let localRole = localStorage.getItem("azureRole" + type);
            azureRole[type] = localRole ? localRole : void 0;
        }
    };
    const voiceChange = () => {
        let localVoice = localStorage.getItem("voice" + voiceType);
        if (localVoice) {
            let localIndex = voices.findIndex((item) => {
                return item.name === localVoice;
            });
            if (localIndex === -1) localIndex = 0;
            voiceRole[voiceType] = voices[localIndex];
            voicesEle.value = localIndex;
        }
        voicesEle.dispatchEvent(new Event("change"));
    };
    voiceChange();
    loadAnother(voiceType);
    let volumeEle = document.getElementById("voiceVolume");
    let localVolume = localStorage.getItem("voiceVolume0");
    voiceVolume[0] = parseFloat(localVolume ? localVolume : volumeEle.value);
    const voiceVolumeChange = () => {
        let localVolume = localStorage.getItem("voiceVolume" + voiceType);
        if (localVolume) {
            voiceVolume[voiceType] = parseFloat(localVolume);
            volumeEle.value = localVolume;
            volumeEle.style.backgroundSize =
                ((volumeEle.value - volumeEle.min) * 100) /
                (volumeEle.max - volumeEle.min) +
                "% 100%";
        } else {
            volumeEle.dispatchEvent(new Event("input"));
        }
    };
    volumeEle.oninput = () => {
        volumeEle.style.backgroundSize =
            ((volumeEle.value - volumeEle.min) * 100) /
            (volumeEle.max - volumeEle.min) +
            "% 100%";
        voiceVolume[voiceType] = parseFloat(volumeEle.value);
        localStorage.setItem("voiceVolume" + voiceType, volumeEle.value);
    };
    voiceVolumeChange();
    let rateEle = document.getElementById("voiceRate");
    let localRate = localStorage.getItem("voiceRate0");
    voiceRate[0] = parseFloat(localRate ? localRate : rateEle.value);
    const voiceRateChange = () => {
        let localRate = localStorage.getItem("voiceRate" + voiceType);
        if (localRate) {
            voiceRate[voiceType] = parseFloat(localRate);
            rateEle.value = localRate;
            rateEle.style.backgroundSize =
                ((rateEle.value - rateEle.min) * 100) / (rateEle.max - rateEle.min) +
                "% 100%";
        } else {
            rateEle.dispatchEvent(new Event("input"));
        }
    };
    rateEle.oninput = () => {
        rateEle.style.backgroundSize =
            ((rateEle.value - rateEle.min) * 100) / (rateEle.max - rateEle.min) +
            "% 100%";
        voiceRate[voiceType] = parseFloat(rateEle.value);
        localStorage.setItem("voiceRate" + voiceType, rateEle.value);
    };
    voiceRateChange();
    let pitchEle = document.getElementById("voicePitch");
    let localPitch = localStorage.getItem("voicePitch0");
    voicePitch[0] = parseFloat(localPitch ? localPitch : pitchEle.value);
    const voicePitchChange = () => {
        let localPitch = localStorage.getItem("voicePitch" + voiceType);
        if (localPitch) {
            voicePitch[voiceType] = parseFloat(localPitch);
            pitchEle.value = localPitch;
            pitchEle.style.backgroundSize =
                ((pitchEle.value - pitchEle.min) * 100) /
                (pitchEle.max - pitchEle.min) +
                "% 100%";
        } else {
            pitchEle.dispatchEvent(new Event("input"));
        }
    };
    pitchEle.oninput = () => {
        pitchEle.style.backgroundSize =
            ((pitchEle.value - pitchEle.min) * 100) / (pitchEle.max - pitchEle.min) +
            "% 100%";
        voicePitch[voiceType] = parseFloat(pitchEle.value);
        localStorage.setItem("voicePitch" + voiceType, pitchEle.value);
    };
    voicePitchChange();
    document.getElementById("voiceTypes").onclick = (ev) => {
        let type = ev.target.dataset.type;
        if (type !== void 0) {
            type = parseInt(type);
            if (type != voiceType) {
                voiceType = type;
                ev.target.classList.add("selVoiceType");
                ev.target.parentElement.children[type ^ 1].classList.remove(
                    "selVoiceType"
                );
                voiceChange();
                voiceVolumeChange();
                voiceRateChange();
                voicePitchChange();
            }
        }
    };
    const contVoiceEle = document.getElementById("enableContVoice");
    let localCont = localStorage.getItem("enableContVoice");
    if (localCont) {
        enableContVoice = localCont === "true";
        contVoiceEle.checked = enableContVoice;
    }
    contVoiceEle.onchange = () => {
        enableContVoice = contVoiceEle.checked;
        localStorage.setItem("enableContVoice", enableContVoice);
    };
    contVoiceEle.dispatchEvent(new Event("change"));
    const autoVoiceEle = document.getElementById("enableAutoVoice");
    let localAuto = localStorage.getItem("enableAutoVoice");
    if (localAuto) {
        enableAutoVoice = localAuto === "true";
        autoVoiceEle.checked = enableAutoVoice;
    }
    autoVoiceEle.onchange = () => {
        enableAutoVoice = autoVoiceEle.checked;
        localStorage.setItem("enableAutoVoice", enableAutoVoice);
    };
    autoVoiceEle.dispatchEvent(new Event("change"));
};
speechServiceEle.dispatchEvent(new Event("change"));
