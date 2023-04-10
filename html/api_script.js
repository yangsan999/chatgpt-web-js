const API_URL = "v1/chat/completions";
let loading = false;
let presetRoleData = {
    normal: "你是一个乐于助人的助手，尽量简明扼要地回答，使用Markdown格式回复。",
    cat: "你是一个可爱的猫娘，每句话结尾都要带个'喵'",
    emoji: "你的性格很活泼，每句话中都要有至少一个emoji图标",
    image:
        "当你需要发送图片的时候，请用 markdown 语言生成，不要反斜线，不要代码框，需要使用 unsplash API时，遵循一下格式， https://source.unsplash.com/960x640/? ＜英文关键词＞",
};
let modelVersion; // 模型版本
let apiHost; // api反代地址
let customAPIKey; // 自定义apiKey
let systemRole; // 自定义系统角色
let roleNature; // 角色性格
let roleTemp; // 回答质量
let enableCont; // 是否开启连续对话，默认开启，对话包含上下文信息。
let enableLongReply; // 是否开启长回复，默认关闭，开启可能导致api费用增加。
let longReplyFlag;
let textSpeed; // 打字机速度，越小越快
let voiceIns; // Audio or SpeechSynthesisUtterance
let supportMSE = !!window.MediaSource; // 是否支持MSE（除了ios应该都支持）
let voiceMIME = "audio/mpeg";
const scrollToBottom = () => {
    if (
        messagsEle.scrollHeight -
        messagsEle.scrollTop -
        messagsEle.clientHeight <
        128
    ) {
        messagsEle.scrollTo(0, messagsEle.scrollHeight);
    }
};
const scrollToBottomLoad = (ele) => {
    if (
        messagsEle.scrollHeight -
        messagsEle.scrollTop -
        messagsEle.clientHeight <
        ele.clientHeight + 128
    ) {
        messagsEle.scrollTo(0, messagsEle.scrollHeight);
    }
};
const md = markdownit({
    linkify: true, // 识别链接
    highlight: function (str, lang) {
        // markdown高亮
        try {
            return hljs.highlightAuto(str).value;
        } catch (e) { }
        return ""; // use external default escaping
    },
});
md.use(texmath, {
    engine: katex,
    delimiters: "dollars",
    katexOptions: { macros: { "\\RR": "\\mathbb{R}" } },
}).use(markdownitLinkAttributes, {
    attrs: { target: "_blank", rel: "noopener" },
});
const x = {
    getCodeLang(str = "") {
        const res = str.match(/ class="language-(.*?)"/);
        return (res && res[1]) || "";
    },
    getFragment(str = "") {
        return str ? `<span class="u-mdic-copy-code_lang">${str}</span>` : "";
    },
};
const strEncode = (str = "") => {
    if (!str || str.length === 0) return "";
    return str
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/'/g, "'")
        .replace(/"/g, "&quot;");
};
const getCodeLangFragment = (oriStr = "") => {
    return x.getFragment(x.getCodeLang(oriStr));
};
const copyClickCode = (ele) => {
    const input = document.createElement("textarea");
    input.value = ele.dataset.mdicContent;
    const nDom = ele.previousElementSibling;
    const nDelay = ele.dataset.mdicNotifyDelay;
    const cDom = nDom.previousElementSibling;
    document.body.appendChild(input);
    input.select();
    input.setSelectionRange(0, 9999);
    document.execCommand("copy");
    document.body.removeChild(input);
    if (nDom.style.display === "none") {
        nDom.style.display = "block";
        cDom && (cDom.style.display = "none");
        setTimeout(() => {
            nDom.style.display = "none";
            cDom && (cDom.style.display = "block");
        }, nDelay);
    }
};
const copyClickMd = (idx) => {
    const input = document.createElement("textarea");
    input.value = data[idx].content;
    document.body.appendChild(input);
    input.select();
    input.setSelectionRange(0, 9999);
    document.execCommand("copy");
    document.body.removeChild(input);
};
const enhanceCode =
    (render, options = {}) =>
        (...args) => {
            /* args = [tokens, idx, options, env, slf] */
            const {
                btnText = "复制代码", // button text
                successText = "复制成功", // copy-success text
                successTextDelay = 2000, // successText show time [ms]
                showCodeLanguage = true, // false | show code language
            } = options;
            const [tokens = {}, idx = 0] = args;
            const cont = strEncode(tokens[idx].content || "");
            const originResult = render.apply(this, args);
            const langFrag = showCodeLanguage
                ? getCodeLangFragment(originResult)
                : "";
            const tpls = [
                '<div class="m-mdic-copy-wrapper">',
                `${langFrag}`,
                `<div class="u-mdic-copy-notify" style="display:none;">${successText}</div>`,
                "<button ",
                'class="u-mdic-copy-btn j-mdic-copy-btn" ',
                `data-mdic-content="${cont}" `,
                `data-mdic-notify-delay="${successTextDelay}" `,
                `onclick="copyClickCode(this)">${btnText}</button>`,
                "</div>",
            ];
            const LAST_TAG = "</pre>";
            const newResult = originResult.replace(
                LAST_TAG,
                `${tpls.join("")}${LAST_TAG}`
            );
            return newResult;
        };
const codeBlockRender = md.renderer.rules.code_block;
const fenceRender = md.renderer.rules.fence;
md.renderer.rules.code_block = enhanceCode(codeBlockRender);
md.renderer.rules.fence = enhanceCode(fenceRender);
md.renderer.rules.image = function (tokens, idx, options, env, slf) {
    let token = tokens[idx];
    token.attrs[token.attrIndex("alt")][1] = slf.renderInlineAsText(
        token.children,
        options,
        env
    );
    token.attrSet(
        "onload",
        "scrollToBottomLoad(this);this.removeAttribute('onload');this.removeAttribute('onerror')"
    );
    token.attrSet(
        "onerror",
        "scrollToBottomLoad(this);this.removeAttribute('onload');this.removeAttribute('onerror')"
    );
    return slf.renderToken(tokens, idx, options);
};
const mdOptionEvent = function (ev) {
    let id = ev.target.dataset.id;
    if (id) {
        let parent = ev.target.parentElement;
        let idxEle = parent.parentElement;
        let idx = Array.prototype.indexOf.call(
            chatlog.children,
            this.parentElement
        );
        if (id === "voiceMd") {
            let className = parent.className;
            if (className == "readyVoice") {
                if (chatlog.children[idx].dataset.loading !== "true") {
                    idx = systemRole ? idx + 1 : idx;
                    speechEvent(idx);
                }
            } else if (className == "pauseVoice") {
                if (existVoice >= 2) {
                    if (voiceIns) voiceIns.pause();
                } else {
                    speechSynthesis.pause();
                }
                parent.className = "resumeVoice";
            } else {
                if (existVoice >= 2) {
                    if (voiceIns) voiceIns.play();
                } else {
                    speechSynthesis.resume();
                }
                parent.className = "pauseVoice";
            }
        } else if (id === "refreshMd") {
            if (!loading && chatlog.children[idx].dataset.loading !== "true") {
                let className = parent.className;
                if (className == "refreshReq") {
                    chatlog.children[idx].children[0].innerHTML = "<br />";
                    chatlog.children[idx].dataset.loading = true;
                    idx = systemRole ? idx + 1 : idx;
                    data[idx].content = "";
                    if (idx === currentVoiceIdx) {
                        endSpeak();
                    }
                    loadAction(true);
                    refreshIdx = idx;
                    streamGen();
                } else {
                    chatlog.children[idx].dataset.loading = true;
                    idx = systemRole ? idx + 1 : idx;
                    progressData = data[idx].content;
                    loadAction(true);
                    refreshIdx = idx;
                    streamGen(true);
                }
            }
        } else if (id === "copyMd") {
            idxEle.classList.add("moreOptionHidden");
            idx = systemRole ? idx + 1 : idx;
            copyClickMd(idx);
            notyf.success("复制成功");
        } else if (id === "delMd") {
            idxEle.classList.add("moreOptionHidden");
            if (!loading) {
                if (confirmAction("是否删除此消息?")) {
                    if (currentVoiceIdx) {
                        if (currentVoiceIdx === idx) {
                            endSpeak();
                        } else if (currentVoiceIdx > idx) {
                            currentVoiceIdx -= 1;
                        }
                    }
                    chatlog.removeChild(chatlog.children[idx]);
                    idx = systemRole ? idx + 1 : idx;
                    data.splice(idx, 1);
                    updateChats();
                }
            }
        } else if (id === "downAudio") {
            idxEle.classList.add("moreOptionHidden");
            if (chatlog.children[idx].dataset.loading !== "true") {
                idx = systemRole ? idx + 1 : idx;
                downloadAudio(idx);
            }
        }
    }
};
const moreOption = (ele) => {
    ele.classList.remove("moreOptionHidden");
};
const formatMdEle = (ele) => {
    let realMd = document.createElement("div");
    realMd.className = "markdown-body";
    ele.appendChild(realMd);
    let mdOption = document.createElement("div");
    mdOption.className = "mdOption";
    ele.appendChild(mdOption);
    if (ele.className !== "request") {
        mdOption.innerHTML = `<div class="refreshReq">
              <svg data-id="refreshMd" width="16" height="16" role="img"><title>刷新</title><use xlink:href="optionIcon.svg#refreshIcon" /></svg>
              <svg data-id="refreshMd" width="16" height="16" role="img"><title>继续</title><use xlink:href="optionIcon.svg#halfRefIcon" /></svg>
          </div>`;
    }
    let optionWidth = existVoice >= 2 ? "96px" : "63px";
    mdOption.innerHTML +=
        `<div class="moreOption" onmouseenter="moreOption(this)">
      <svg class="optionTrigger" width="16" height="16" role="img"><title>选项</title><use xlink:href="optionIcon.svg#optionIcon" /></svg>
      <div class="optionItems" style="width:${optionWidth};left:-${optionWidth}">` +
        (existVoice >= 2
            ? `<div data-id="downAudio" class="optionItem" title="下载语音">
          <svg width="20" height="20"><use xlink:href="optionIcon.svg#downAudioIcon" /></svg>
      </div>`
            : "") +
        `<div data-id="delMd" class="optionItem" title="删除">
          <svg width="20" height="20"><use xlink:href="optionIcon.svg#delIcon" /></svg>
      </div>
      <div data-id="copyMd" class="optionItem" title="复制">
          <svg width="20" height="20"><use xlink:href="optionIcon.svg#copyIcon" /></svg>
      </div></div></div>`;
    if (existVoice) {
        mdOption.innerHTML += `<div id="pronMd" class="readyVoice">
          <svg width="16" height="16" data-id="voiceMd" role="img"><title>朗读</title><use xlink:href="optionIcon.svg#readyVoiceIcon" /></svg>
          <svg width="16" height="16" data-id="voiceMd" role="img"><title>暂停</title><use xlink:href="optionIcon.svg#pauseVoiceIcon" /></svg>
          <svg width="16" height="16" data-id="voiceMd" role="img"><title>继续</title><use xlink:href="optionIcon.svg#resumeVoiceIcon" /></svg>
          </div>`;
    }
    mdOption.onclick = mdOptionEvent;
};
let chatsData = [];
let activeChatIdx = 0;
let data;
const chatEleAdd = (idx) => {
    let chat = chatsData[idx];
    let chatEle = document.createElement("div");
    chatEle.className = "chatLi";
    chatEle.innerHTML = `<svg width="24" height="24"><use xlink:href="optionIcon.svg#chatIcon" /></svg>
          <div class="chatName">${chat.name}</div>
          <div class="chatOption"><svg data-type="chatEdit" style="margin-right:4px" width="24" height="24" role="img"><title>编辑</title><use xlink:href="optionIcon.svg#chatEditIcon" /></svg>
          <svg data-type="chatDel" width="24" height="24" role="img"><title>删除</title><use xlink:href="optionIcon.svg#delIcon" /></svg></div>`;
    chatListEle.appendChild(chatEle);
    chatEle.onclick = chatEleEvent;
    return chatEle;
};
const addNewChat = () => {
    let chat = { name: "新的会话", data: [] };
    chatsData.push(chat);
    updateChats();
};
const delChat = (idx) => {
    if (confirmAction("是否删除会话?")) {
        endAll();
        if (idx === activeChatIdx) {
            if (idx - 1 >= 0) {
                activeChatIdx = idx - 1;
            } else if (idx === chatsData.length - 1) {
                activeChatIdx = chatsData.length - 2;
            }
        }
        chatsData.splice(idx, 1);
        chatListEle.children[idx].remove();
        if (activeChatIdx === -1) {
            addNewChat();
            activeChatIdx = 0;
            chatEleAdd(activeChatIdx);
        }
        updateChats();
        activeChat();
    }
};
const endEditEvent = (ev) => {
    let activeEle = document.getElementById("activeChatEdit");
    if (!activeEle.contains(ev.target)) {
        let ele = chatListEle.children[activeChatIdx];
        chatsData[activeChatIdx].name = activeEle.value;
        ele.children[1].textContent = activeEle.value;
        ele.lastElementChild.remove();
        updateChats();
        document.body.removeEventListener("mousedown", endEditEvent, true);
    }
};
const toEditChatName = (idx) => {
    let inputEle = document.createElement("input");
    inputEle.id = "activeChatEdit";
    inputEle.value = chatsData[idx].name;
    chatListEle.children[idx].appendChild(inputEle);
    inputEle.focus();
    document.body.addEventListener("mousedown", endEditEvent, true);
};
const chatEleEvent = function (ev) {
    ev.preventDefault();
    ev.stopPropagation();
    let idx = Array.prototype.indexOf.call(chatListEle.children, this);
    if (ev.target.className === "chatLi") {
        if (activeChatIdx !== idx) {
            endAll();
            activeChatIdx = idx;
            activeChat();
        }
        document.body.classList.remove("show-nav");
    } else if (ev.target.dataset.type === "chatEdit") {
        toEditChatName(idx);
    } else if (ev.target.dataset.type === "chatDel") {
        delChat(idx);
    }
};
const updateChats = () => {
    localStorage.setItem("chats", JSON.stringify(chatsData));
};
const createConvEle = (className) => {
    let div = document.createElement("div");
    div.className = className;
    chatlog.appendChild(div);
    formatMdEle(div);
    return div;
};
const activeChat = () => {
    data = chatsData[activeChatIdx]["data"];
    Array.from(document.getElementsByClassName("activeChatLi")).forEach(
        (item) => {
            item.classList.remove("activeChatLi");
        }
    );
    chatListEle.children[activeChatIdx].classList.add("activeChatLi");
    if (data[0] && data[0].role === "system") {
        systemRole = data[0].content;
        systemEle.value = systemRole;
        localStorage.setItem("system", systemRole);
    } else {
        systemRole = "";
        systemEle.value = "";
        localStorage.setItem("system", systemRole);
    }
    chatlog.innerHTML = "";
    if (systemRole ? data.length - 1 : data.length) {
        let firstIdx = systemRole ? 1 : 0;
        for (let i = firstIdx; i < data.length; i++) {
            createConvEle(
                data[i].role === "user" ? "request" : "response"
            ).children[0].innerHTML = md.render(data[i].content) || "<br />";
        }
    }
    localStorage.setItem("activeChatIdx", activeChatIdx);
};
newChatEle.onclick = () => {
    endAll();
    addNewChat();
    activeChatIdx = chatsData.length - 1;
    chatEleAdd(activeChatIdx);
    activeChat();
};
const initChats = () => {
    let localChats = localStorage.getItem("chats");
    let localChatIdx = localStorage.getItem("activeChatIdx");
    activeChatIdx = (localChatIdx && parseInt(localChatIdx)) || 0;
    if (localChats) {
        chatsData = JSON.parse(localChats);
        for (let i = 0; i < chatsData.length; i++) {
            chatEleAdd(i);
        }
    } else {
        addNewChat();
        chatEleAdd(activeChatIdx);
    }
};
initChats();
activeChat();
document.getElementById("exportChat").onclick = () => {
    if (loading) {
        stopLoading();
    }
    let blob = new Blob([JSON.stringify(chatsData, null, 2)], {
        type: "application/json",
    });
    let date = new Date();
    let fileName =
        "chats-" +
        date.getFullYear() +
        "-" +
        (date.getMonth() + 1) +
        "-" +
        date.getDate() +
        ".json";
    downBlob(blob, fileName);
};
const blobToText = (blob) => {
    return new Promise((res, rej) => {
        let reader = new FileReader();
        reader.readAsText(blob);
        reader.onload = () => {
            res(reader.result);
        };
        reader.onerror = (error) => {
            rej(error);
        };
    });
};
document.getElementById("importChatInput").onchange = function () {
    let file = this.files[0];
    blobToText(file).then((text) => {
        try {
            let json = JSON.parse(text);
            let checked = json.every((item) => {
                return item.name !== void 0 && item.data !== void 0;
            });
            if (checked) {
                while (json.length) {
                    chatsData.push(json.shift());
                    chatEleAdd(chatsData.length - 1);
                }
                updateChats();
            } else {
                throw new Error("格式检查不通过");
            }
        } catch (e) {
            notyf.error("导入失败，请检查文件是否正确！");
        }
        this.value = "";
    });
};
document.getElementById("clearChat").onclick = () => {
    if (confirmAction("是否清空所有会话?")) {
        chatsData.length = 0;
        chatListEle.innerHTML = "";
        endAll();
        addNewChat();
        activeChatIdx = 0;
        chatEleAdd(activeChatIdx);
        updateChats();
        activeChat();
    }
};
const endAll = () => {
    endSpeak();
    if (loading) stopLoading();
};
const initSetting = () => {
    const modelEle = document.getElementById("preSetModel");
    let localModel = localStorage.getItem("modelVersion");
    if (localModel) {
        modelVersion = localModel;
        modelEle.value = localModel;
    }
    modelEle.onchange = () => {
        modelVersion = modelEle.value;
        localStorage.setItem("modelVersion", modelVersion);
    };
    modelEle.dispatchEvent(new Event("change"));
    const apiHostEle = document.getElementById("apiHostInput");
    let localApiHost = localStorage.getItem("APIHost");
    if (localApiHost) {
        apiHost = localApiHost;
        apiHostEle.value = localApiHost;
    }
    apiHostEle.onchange = () => {
        apiHost = apiHostEle.value;
        localStorage.setItem("APIHost", apiHost);
    };
    apiHostEle.dispatchEvent(new Event("change"));
    const keyEle = document.getElementById("keyInput");
    let localKey = localStorage.getItem("APIKey");
    if (localKey) {
        customAPIKey = localKey;
        keyEle.value = localKey;
    }
    keyEle.onchange = () => {
        customAPIKey = keyEle.value;
        localStorage.setItem("APIKey", customAPIKey);
    };
    keyEle.dispatchEvent(new Event("change"));
    if (systemRole === void 0) {
        let localSystem = localStorage.getItem("system");
        if (localSystem) {
            systemRole = localSystem;
            systemEle.value = localSystem;
            data.unshift({ role: "system", content: systemRole });
            updateChats();
        } else {
            systemRole = systemEle.value;
        }
    }
    systemEle.onchange = () => {
        systemRole = systemEle.value;
        localStorage.setItem("system", systemRole);
        if (systemRole) {
            if (data[0] && data[0].role === "system") {
                data[0].content = systemRole;
            } else {
                data.unshift({ role: "system", content: systemRole });
            }
        } else if (data[0] && data[0].role === "system") {
            data.shift();
        }
        updateChats();
    };
    const preEle = document.getElementById("preSetSystem");
    preEle.onchange = () => {
        let val = preEle.value;
        if (val && presetRoleData[val]) {
            systemEle.value = presetRoleData[val];
        } else {
            systemEle.value = "";
        }
        systemEle.dispatchEvent(new Event("change"));
        systemEle.focus();
    };
    const topEle = document.getElementById("top_p");
    let localTop = localStorage.getItem("top_p");
    if (localTop) {
        roleNature = parseFloat(localTop);
        topEle.value = localTop;
    }
    topEle.oninput = () => {
        topEle.style.backgroundSize =
            ((topEle.value - topEle.min) * 100) / (topEle.max - topEle.min) +
            "% 100%";
        roleNature = parseFloat(topEle.value);
        localStorage.setItem("top_p", topEle.value);
    };
    topEle.dispatchEvent(new Event("input"));
    const tempEle = document.getElementById("temp");
    let localTemp = localStorage.getItem("temp");
    if (localTemp) {
        roleTemp = parseFloat(localTemp);
        tempEle.value = localTemp;
    }
    tempEle.oninput = () => {
        tempEle.style.backgroundSize =
            ((tempEle.value - tempEle.min) * 100) /
            (tempEle.max - tempEle.min) +
            "% 100%";
        roleTemp = parseFloat(tempEle.value);
        localStorage.setItem("temp", tempEle.value);
    };
    tempEle.dispatchEvent(new Event("input"));
    const speedEle = document.getElementById("textSpeed");
    let localSpeed = localStorage.getItem("textSpeed");
    if (localSpeed) {
        textSpeed = parseFloat(speedEle.min) + (speedEle.max - localSpeed);
        speedEle.value = localSpeed;
    }
    speedEle.oninput = () => {
        speedEle.style.backgroundSize =
            ((speedEle.value - speedEle.min) * 100) /
            (speedEle.max - speedEle.min) +
            "% 100%";
        textSpeed =
            parseFloat(speedEle.min) + (speedEle.max - speedEle.value);
        localStorage.setItem("textSpeed", speedEle.value);
    };
    speedEle.dispatchEvent(new Event("input"));
    const contEle = document.getElementById("enableCont");
    let localCont = localStorage.getItem("enableCont");
    if (localCont) {
        enableCont = localCont === "true";
        contEle.checked = enableCont;
    }
    contEle.onchange = () => {
        enableCont = contEle.checked;
        localStorage.setItem("enableCont", enableCont);
    };
    contEle.dispatchEvent(new Event("change"));
    const longEle = document.getElementById("enableLongReply");
    let localLong = localStorage.getItem("enableLongReply");
    if (localLong) {
        enableLongReply = localLong === "true";
        longEle.checked = enableLongReply;
    }
    longEle.onchange = () => {
        enableLongReply = longEle.checked;
        localStorage.setItem("enableLongReply", enableLongReply);
    };
    longEle.dispatchEvent(new Event("change"));
};
initSetting();
document.getElementById("loadMask").style.display = "none";
const closeEvent = (ev) => {
    if (settingEle.contains(ev.target)) return;
    if (!dialogEle.contains(ev.target)) {
        dialogEle.style.display = "none";
        document.removeEventListener("mousedown", closeEvent, true);
        settingEle.classList.remove("showSetting");
    }
};
settingEle.onmousedown = () => {
    dialogEle.style.display =
        dialogEle.style.display === "block" ? "none" : "block";
    if (dialogEle.style.display === "block") {
        document.addEventListener("mousedown", closeEvent, true);
        settingEle.classList.add("showSetting");
    } else {
        document.removeEventListener("mousedown", closeEvent, true);
        settingEle.classList.remove("showSetting");
    }
};
let delayId;
const delay = () => {
    return new Promise(
        (resolve) => (delayId = setTimeout(resolve, textSpeed))
    ); //打字机时间间隔
};
const uuidv4 = () => {
    let uuid = ([1e7] + 1e3 + 4e3 + 8e3 + 1e11).replace(/[018]/g, (c) =>
        (
            c ^
            (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
        ).toString(16)
    );
    return existVoice === 3 ? uuid.toUpperCase() : uuid;
};
const getTime = () => {
    return existVoice === 3
        ? new Date().toISOString()
        : new Date().toString();
};
const getWSPre = (date, requestId) => {
    let osPlatform = typeof window !== "undefined" ? "Browser" : "Node";
    osPlatform += "/" + navigator.platform;
    let osName = navigator.userAgent;
    let osVersion = navigator.appVersion;
    return `Path: speech.config\r\nX-RequestId: ${requestId}\r\nX-Timestamp: ${date}\r\nContent-Type: application/json\r\n\r\n{"context":{"system":{"name":"SpeechSDK","version":"1.26.0","build":"JavaScript","lang":"JavaScript","os":{"platform":"${osPlatform}","name":"${osName}","version":"${osVersion}"}}}}`;
};
const getWSAudio = (date, requestId) => {
    return existVoice === 3
        ? `Path: synthesis.context\r\nX-RequestId: ${requestId}\r\nX-Timestamp: ${date}\r\nContent-Type: application/json\r\n\r\n{"synthesis":{"audio":{"metadataOptions":{"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":false},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}`
        : `X-Timestamp:${date}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
};
const getWSText = (
    date,
    requestId,
    lang,
    voice,
    volume,
    rate,
    pitch,
    style,
    role,
    msg
) => {
    let fmtVolume = volume === 1 ? "+0%" : volume * 100 - 100 + "%";
    let fmtRate = (rate >= 1 ? "+" : "") + (rate * 100 - 100) + "%";
    let fmtPitch = (pitch >= 1 ? "+" : "") + (pitch - 1) + "Hz";
    if (existVoice === 3) {
        let fmtStyle = style ? ` style="${style}"` : "";
        let fmtRole = role ? ` role="${role}"` : "";
        let fmtExpress = fmtStyle + fmtRole;
        return `Path: ssml\r\nX-RequestId: ${requestId}\r\nX-Timestamp: ${date}\r\nContent-Type: application/ssml+xml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='${lang}'><voice name='${voice}'><mstts:express-as${fmtExpress}><prosody pitch='${fmtPitch}' rate='${fmtRate}' volume='${fmtVolume}'>${msg}</prosody></mstts:express-as></voice></speak>`;
    } else {
        return `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${date}Z\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='${lang}'><voice name='${voice}'><prosody pitch='${fmtPitch}' rate='${fmtRate}' volume='${fmtVolume}'>${msg}</prosody></voice></speak>`;
    }
};
const getAzureWSURL = () => {
    return `wss://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/websocket/v1?Authorization=bearer%20${azureToken}`;
};
const edgeTTSURL =
    "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4";
let currentVoiceIdx;
const resetSpeakIcon = () => {
    if (currentVoiceIdx !== void 0) {
        chatlog.children[
            systemRole ? currentVoiceIdx - 1 : currentVoiceIdx
        ].children[1].lastChild.className = "readyVoice";
    }
};
const endSpeak = () => {
    resetSpeakIcon();
    if (existVoice >= 2) {
        if (voiceIns) {
            voiceIns.pause();
            voiceIns.currentTime = 0;
            URL.revokeObjectURL(voiceIns.src);
            voiceIns.removeAttribute("src");
            voiceIns.onended = voiceIns.onerror = null;
        }
        sourceBuffer = void 0;
        speechPushing = false;
        if (voiceSocket && voiceSocket["pending"]) {
            voiceSocket.close();
        }
        if (autoVoiceSocket && autoVoiceSocket["pending"]) {
            autoVoiceSocket.close();
        }
        speechQuene.length = 0;
        autoMediaSource = void 0;
        voiceContentQuene = [];
        voiceEndFlagQuene = [];
        voiceBlobURLQuene = [];
        autoOnlineVoiceFlag = false;
    } else {
        speechSynthesis.cancel();
    }
    currentVoiceIdx = void 0;
};
const speakEvent = (ins, force = true, end = false) => {
    return new Promise((res, rej) => {
        ins.onerror = () => {
            if (end) {
                endSpeak();
            } else if (force) {
                resetSpeakIcon();
            }
            res();
        };
        if (existVoice >= 2) {
            ins.onended = ins.onerror;
            ins.play();
        } else {
            ins.onend = ins.onerror;
            speechSynthesis.speak(voiceIns);
        }
    });
};
let voiceData = [];
let voiceSocket;
let speechPushing = false;
let speechQuene = [];
let sourceBuffer;
speechQuene.push = function (buffer) {
    if (!speechPushing && !sourceBuffer.updating) {
        speechPushing = true;
        sourceBuffer.appendBuffer(buffer);
    } else {
        Array.prototype.push.call(this, buffer);
    }
};
const initSocket = () => {
    return new Promise((res, rej) => {
        if (!voiceSocket || voiceSocket.readyState > 1) {
            voiceSocket = new WebSocket(
                existVoice === 3 ? getAzureWSURL() : edgeTTSURL
            );
            voiceSocket.binaryType = "arraybuffer";
            voiceSocket.onopen = () => {
                res();
            };
            voiceSocket.onerror = () => {
                rej();
            };
        } else {
            return res();
        }
    });
};
const initStreamVoice = (mediaSource) => {
    return new Promise((r, j) => {
        Promise.all([
            initSocket(),
            new Promise((res) => {
                mediaSource.onsourceopen = () => {
                    res();
                };
            }),
        ]).then(() => {
            r();
        });
    });
};
let downQuene = {};
let downSocket;
const downBlob = (blob, name) => {
    let a = document.createElement("a");
    a.download = name;
    a.href = URL.createObjectURL(blob);
    a.click();
};
const initDownSocket = () => {
    return new Promise((res, rej) => {
        if (!downSocket || downSocket.readyState > 1) {
            downSocket = new WebSocket(
                existVoice === 3 ? getAzureWSURL() : edgeTTSURL
            );
            downSocket.binaryType = "arraybuffer";
            downSocket.onopen = () => {
                res();
            };
            downSocket.onmessage = (e) => {
                if (e.data instanceof ArrayBuffer) {
                    let text = new TextDecoder().decode(e.data.slice(0, 130));
                    let reqIdx = text.indexOf(":");
                    let uuid = text.slice(reqIdx + 1, reqIdx + 33);
                    downQuene[uuid]["blob"].push(e.data.slice(130));
                } else if (e.data.indexOf("Path:turn.end") !== -1) {
                    let reqIdx = e.data.indexOf(":");
                    let uuid = e.data.slice(reqIdx + 1, reqIdx + 33);
                    let blob = new Blob(downQuene[uuid]["blob"], {
                        type: voiceMIME,
                    });
                    let key = downQuene[uuid]["key"];
                    let name = downQuene[uuid]["name"];
                    voiceData[key] = blob;
                    downBlob(blob, name.slice(0, 16) + ".mp3");
                }
            };
            downSocket.onerror = () => {
                rej();
            };
        } else {
            return res();
        }
    });
};
const downloadAudio = async (idx) => {
    if (existVoice < 2) {
        return;
    }
    let type = data[idx].role === "user" ? 0 : 1;
    let voice =
        existVoice === 3 ? voiceRole[type].ShortName : voiceRole[type].Name;
    let volume = voiceVolume[type];
    let rate = voiceRate[type];
    let pitch = voicePitch[type];
    let style = azureStyle[type];
    let role = azureRole[type];
    let content = data[idx].content;
    let key =
        content +
        voice +
        volume +
        rate +
        pitch +
        (style ? style : "") +
        (role ? role : "");
    let blob = voiceData[key];
    if (blob) {
        downBlob(blob, content.slice(0, 16) + ".mp3");
    } else {
        await initDownSocket();
        let currDate = getTime();
        let lang = voiceRole[type].lang;
        let uuid = uuidv4();
        if (existVoice === 3) {
            downSocket.send(getWSPre(currDate, uuid));
        }
        downSocket.send(getWSAudio(currDate, uuid));
        downSocket.send(
            getWSText(
                currDate,
                uuid,
                lang,
                voice,
                volume,
                rate,
                pitch,
                style,
                role,
                content
            )
        );
        downSocket["pending"] = true;
        downQuene[uuid] = {};
        downQuene[uuid]["name"] = content;
        downQuene[uuid]["key"] = key;
        downQuene[uuid]["blob"] = [];
    }
};
const NoMSEPending = (key) => {
    return new Promise((res, rej) => {
        let bufArray = [];
        voiceSocket.onmessage = (e) => {
            if (e.data instanceof ArrayBuffer) {
                bufArray.push(e.data.slice(130));
            } else if (e.data.indexOf("Path:turn.end") !== -1) {
                voiceSocket["pending"] = false;
                voiceData[key] = new Blob(bufArray, { type: voiceMIME });
                res(voiceData[key]);
            }
        };
    });
};
const speechEvent = async (idx) => {
    if (!data[idx]) return;
    endSpeak();
    currentVoiceIdx = idx;
    if (!data[idx].content && enableContVoice) {
        if (currentVoiceIdx !== data.length - 1) {
            return speechEvent(currentVoiceIdx + 1);
        } else {
            return endSpeak();
        }
    }
    let type = data[idx].role === "user" ? 0 : 1;
    chatlog.children[
        systemRole ? idx - 1 : idx
    ].children[1].lastChild.className = "pauseVoice";
    let content = data[idx].content;
    let volume = voiceVolume[type];
    let rate = voiceRate[type];
    let pitch = voicePitch[type];
    let style = azureStyle[type];
    let role = azureRole[type];
    if (existVoice >= 2) {
        if (!voiceIns) {
            voiceIns = new Audio();
        }
        let voice =
            existVoice === 3 ? voiceRole[type].ShortName : voiceRole[type].Name;
        let key =
            content +
            voice +
            volume +
            rate +
            pitch +
            (style ? style : "") +
            (role ? role : "");
        let currData = voiceData[key];
        if (currData) {
            voiceIns.src = URL.createObjectURL(currData);
        } else {
            let mediaSource;
            if (supportMSE) {
                mediaSource = new MediaSource();
                voiceIns.src = URL.createObjectURL(mediaSource);
                await initStreamVoice(mediaSource);
                if (!sourceBuffer) {
                    sourceBuffer = mediaSource.addSourceBuffer(voiceMIME);
                }
                sourceBuffer.onupdateend = function () {
                    speechPushing = false;
                    if (speechQuene.length) {
                        let buf = speechQuene.shift();
                        if (buf["end"]) {
                            mediaSource.endOfStream();
                        } else {
                            speechPushing = true;
                            sourceBuffer.appendBuffer(buf);
                        }
                    }
                };
                let bufArray = [];
                voiceSocket.onmessage = (e) => {
                    if (e.data instanceof ArrayBuffer) {
                        let buf = e.data.slice(130);
                        bufArray.push(buf);
                        speechQuene.push(buf);
                    } else if (e.data.indexOf("Path:turn.end") !== -1) {
                        voiceSocket["pending"] = false;
                        voiceData[key] = new Blob(bufArray, { type: voiceMIME });
                        if (!speechQuene.length && !speechPushing) {
                            mediaSource.endOfStream();
                        } else {
                            let buf = new ArrayBuffer();
                            buf["end"] = true;
                            speechQuene.push(buf);
                        }
                    }
                };
            } else {
                await initSocket();
            }
            let currDate = getTime();
            let lang = voiceRole[type].lang;
            let uuid = uuidv4();
            if (existVoice === 3) {
                voiceSocket.send(getWSPre(currDate, uuid));
            }
            voiceSocket.send(getWSAudio(currDate, uuid));
            voiceSocket.send(
                getWSText(
                    currDate,
                    uuid,
                    lang,
                    voice,
                    volume,
                    rate,
                    pitch,
                    style,
                    role,
                    content
                )
            );
            voiceSocket["pending"] = true;
            if (!supportMSE) {
                let blob = await NoMSEPending(key);
                voiceIns.src = URL.createObjectURL(blob);
            }
        }
    } else {
        if (!voiceIns) {
            voiceIns = new SpeechSynthesisUtterance();
        }
        voiceIns.voice = voiceRole[type];
        voiceIns.volume = volume;
        voiceIns.rate = rate;
        voiceIns.pitch = pitch;
        voiceIns.text = content;
    }
    await speakEvent(voiceIns);
    if (enableContVoice) {
        if (currentVoiceIdx !== data.length - 1) {
            return speechEvent(currentVoiceIdx + 1);
        } else {
            endSpeak();
        }
    }
};
let autoVoiceSocket;
let autoMediaSource;
let voiceContentQuene = [];
let voiceEndFlagQuene = [];
let voiceBlobURLQuene = [];
let autoOnlineVoiceFlag = false;
const autoAddQuene = () => {
    if (voiceContentQuene.length) {
        let content = voiceContentQuene.shift();
        let currDate = getTime();
        let uuid = uuidv4();
        let voice = voiceRole[1].Name;
        if (existVoice === 3) {
            autoVoiceSocket.send(getWSPre(currDate, uuid));
            voice = voiceRole[1].ShortName;
        }
        autoVoiceSocket.send(getWSAudio(currDate, uuid));
        autoVoiceSocket.send(
            getWSText(
                currDate,
                uuid,
                voiceRole[1].lang,
                voice,
                voiceVolume[1],
                voiceRate[1],
                voicePitch[1],
                azureStyle[1],
                azureRole[1],
                content
            )
        );
        autoVoiceSocket["pending"] = true;
        autoOnlineVoiceFlag = true;
    }
};
const autoSpeechEvent = (content, ele, force = false, end = false) => {
    if (ele.children[1].lastChild.className === "readyVoice") {
        ele.children[1].lastChild.className = "pauseVoice";
    }
    if (existVoice >= 2) {
        voiceContentQuene.push(content);
        voiceEndFlagQuene.push(end);
        if (!voiceIns) {
            voiceIns = new Audio();
        }
        if (!autoVoiceSocket || autoVoiceSocket.readyState > 1) {
            autoVoiceSocket = new WebSocket(
                existVoice === 3 ? getAzureWSURL() : edgeTTSURL
            );
            autoVoiceSocket.binaryType = "arraybuffer";
            autoVoiceSocket.onopen = () => {
                autoAddQuene();
            };

            autoVoiceSocket.onerror = () => {
                autoOnlineVoiceFlag = false;
            };
        }
        let bufArray = [];
        autoVoiceSocket.onmessage = (e) => {
            if (e.data instanceof ArrayBuffer) {
                (supportMSE ? speechQuene : bufArray).push(e.data.slice(130));
            } else {
                if (e.data.indexOf("Path:turn.end") !== -1) {
                    autoVoiceSocket["pending"] = false;
                    autoOnlineVoiceFlag = false;
                    if (!supportMSE) {
                        let blob = new Blob(bufArray, { type: voiceMIME });
                        bufArray = [];
                        if (blob.size) {
                            let blobURL = URL.createObjectURL(blob);
                            if (!voiceIns.src) {
                                voiceIns.src = blobURL;
                                voiceIns.play();
                            } else {
                                voiceBlobURLQuene.push(blobURL);
                            }
                        }
                        autoAddQuene();
                    }
                    if (voiceEndFlagQuene.shift()) {
                        if (supportMSE) {
                            if (!speechQuene.length && !speechPushing) {
                                autoMediaSource.endOfStream();
                            } else {
                                let buf = new ArrayBuffer();
                                buf["end"] = true;
                                speechQuene.push(buf);
                            }
                        } else {
                            if (!voiceBlobURLQuene.length && !voiceIns.src) {
                                endSpeak();
                            } else {
                                voiceBlobURLQuene.push("end");
                            }
                        }
                    }
                    if (supportMSE) {
                        autoAddQuene();
                    }
                }
            }
        };
        if (!autoOnlineVoiceFlag && autoVoiceSocket.readyState) {
            autoAddQuene();
        }
        if (supportMSE) {
            if (!autoMediaSource) {
                autoMediaSource = new MediaSource();
                autoMediaSource.onsourceopen = () => {
                    if (!sourceBuffer) {
                        sourceBuffer = autoMediaSource.addSourceBuffer(voiceMIME);
                        sourceBuffer.onupdateend = () => {
                            speechPushing = false;
                            if (speechQuene.length) {
                                let buf = speechQuene.shift();
                                if (buf["end"]) {
                                    autoMediaSource.endOfStream();
                                } else {
                                    speechPushing = true;
                                    sourceBuffer.appendBuffer(buf);
                                }
                            }
                        };
                    }
                };
            }
            if (!voiceIns.src) {
                voiceIns.src = URL.createObjectURL(autoMediaSource);
                voiceIns.play();
                voiceIns.onended = voiceIns.onerror = () => {
                    endSpeak();
                };
            }
        } else {
            voiceIns.onended = voiceIns.onerror = () => {
                if (voiceBlobURLQuene.length) {
                    let src = voiceBlobURLQuene.shift();
                    if (src === "end") {
                        endSpeak();
                    } else {
                        voiceIns.src = src;
                        voiceIns.currentTime = 0;
                        voiceIns.play();
                    }
                } else {
                    voiceIns.currentTime = 0;
                    voiceIns.removeAttribute("src");
                }
            };
        }
    } else {
        voiceIns = new SpeechSynthesisUtterance(content);
        voiceIns.volume = voiceVolume[1];
        voiceIns.rate = voiceRate[1];
        voiceIns.pitch = voicePitch[1];
        voiceIns.voice = voiceRole[1];
        speakEvent(voiceIns, force, end);
    }
};
const confirmAction = (prompt) => {
    if (window.confirm(prompt)) {
        return true;
    } else {
        return false;
    }
};
let autoVoiceIdx = 0;
let autoVoiceDataIdx;
let controller;
let controllerId;
let refreshIdx;
let currentResEle;
let progressData = "";
const streamGen = async (long) => {
    controller = new AbortController();
    controllerId = setTimeout(() => {
        notyf.error("请求超时，请稍后重试！");
        stopLoading();
    }, 30000);
    let headers = { "Content-Type": "application/json" };
    if (customAPIKey) headers["Authorization"] = "Bearer " + customAPIKey;
    let isRefresh = refreshIdx !== void 0;
    if (isRefresh) {
        currentResEle =
            chatlog.children[systemRole ? refreshIdx - 1 : refreshIdx];
    } else if (!currentResEle) {
        currentResEle = createConvEle("response");
        currentResEle.children[0].innerHTML = "<br />";
        currentResEle.dataset.loading = true;
        scrollToBottom();
    }
    let idx = isRefresh ? refreshIdx : data.length;
    if (existVoice && enableAutoVoice && !long) {
        if (isRefresh) {
            endSpeak();
            autoVoiceDataIdx = currentVoiceIdx = idx;
        } else if (currentVoiceIdx !== data.length) {
            endSpeak();
            autoVoiceDataIdx = currentVoiceIdx = idx;
        }
    }
    let dataSlice;
    if (long) {
        idx = isRefresh ? refreshIdx : data.length - 1;
        dataSlice = [data[idx - 1], data[idx]];
        if (systemRole) {
            dataSlice.unshift(data[0]);
        }
    } else if (enableCont) {
        dataSlice = data.slice(0, idx);
    } else {
        dataSlice = [data[idx - 1]];
        if (systemRole) {
            dataSlice.unshift(data[0]);
        }
    }
    try {
        const res = await fetch(apiHost + API_URL, {
            method: "POST",
            headers,
            body: JSON.stringify({
                messages: dataSlice,
                model: modelVersion,
                stream: true,
                temperature: roleTemp,
                top_p: roleNature,
            }),
            signal: controller.signal,
        });
        clearTimeout(controllerId);
        controllerId = void 0;
        if (res.status !== 200) {
            if (res.status === 401) {
                notyf.error("API key错误，请打开设置输入正确的API key！");
            } else if (res.status === 400) {
                notyf.error(
                    "请求内容过大，请删除部分对话或打开设置关闭连续对话！"
                );
            } else if (res.status === 404) {
                notyf.error("无权使用此模型，请打开设置选择其他GPT模型！");
            } else if (res.status === 429 && !res.statusText) {
                notyf.error("API使用超出限额，请检查您的账单！");
            } else {
                notyf.error("触发API调用频率限制，请稍后重试！");
            }
            stopLoading();
            return;
        }
        const decoder = new TextDecoder();
        const reader = res.body.getReader();
        const readChunk = async () => {
            return reader.read().then(async ({ value, done }) => {
                if (!done) {
                    value = decoder.decode(value);
                    let chunks = value.split(/\n{2}/g);
                    chunks = chunks.filter((item) => {
                        return item.trim();
                    });
                    for (let i = 0; i < chunks.length; i++) {
                        let chunk = chunks[i];
                        if (chunk) {
                            let payload;
                            try {
                                payload = JSON.parse(chunk.slice(6));
                            } catch (e) {
                                break;
                            }
                            if (payload.choices[0].finish_reason) {
                                let lenStop =
                                    payload.choices[0].finish_reason === "length";
                                let longReplyFlag = enableLongReply && lenStop;
                                if (!enableLongReply && lenStop) {
                                    currentResEle.children[1].children[0].className =
                                        "halfRefReq";
                                } else {
                                    currentResEle.children[1].children[0].className =
                                        "refreshReq";
                                }
                                if (
                                    existVoice &&
                                    enableAutoVoice &&
                                    currentVoiceIdx === autoVoiceDataIdx
                                ) {
                                    let voiceText = longReplyFlag
                                        ? ""
                                        : progressData.slice(autoVoiceIdx),
                                        stop = !longReplyFlag;
                                    autoSpeechEvent(voiceText, currentResEle, false, stop);
                                }
                                break;
                            } else {
                                let content = payload.choices[0].delta.content;
                                if (content) {
                                    if (!progressData && !content.trim()) continue;
                                    if (
                                        existVoice &&
                                        enableAutoVoice &&
                                        currentVoiceIdx === autoVoiceDataIdx
                                    ) {
                                        let spliter = content.match(/\.|\?|!|。|？|！/);
                                        if (spliter) {
                                            let voiceText =
                                                progressData.slice(autoVoiceIdx) +
                                                content.slice(0, spliter.index + 1);
                                            autoVoiceIdx += voiceText.length;
                                            autoSpeechEvent(voiceText, currentResEle);
                                        }
                                    }
                                    if (progressData) await delay();
                                    progressData += content;
                                    currentResEle.children[0].innerHTML =
                                        md.render(progressData);
                                    if (!isRefresh) {
                                        scrollToBottom();
                                    }
                                }
                            }
                        }
                    }
                    return readChunk();
                } else {
                    if (isRefresh) {
                        data[refreshIdx].content = progressData;
                        if (longReplyFlag) return streamGen(true);
                    } else {
                        if (long) {
                            data[data.length - 1].content = progressData;
                        } else {
                            data.push({ role: "assistant", content: progressData });
                        }
                        if (longReplyFlag) return streamGen(true);
                    }
                    stopLoading(false);
                }
            });
        };
        await readChunk();
    } catch (e) {
        if (e.message.indexOf("aborted") === -1) {
            notyf.error("访问接口失败，请检查接口！");
        }
        stopLoading();
    }
};
const loadAction = (bool) => {
    loading = bool;
    sendBtnEle.disabled = bool;
    sendBtnEle.className = bool ? " loading" : "loaded";
    stopEle.style.display = bool ? "flex" : "none";
    textInputEvent();
};
const stopLoading = (abort = true) => {
    stopEle.style.display = "none";
    if (abort) {
        controller.abort();
        if (controllerId) clearTimeout(controllerId);
        if (delayId) clearTimeout(delayId);
        if (refreshIdx !== void 0) {
            data[refreshIdx].content = progressData;
        } else if (data[data.length - 1].role === "assistant") {
            data[data.length - 1].content = progressData;
        } else {
            data.push({ role: "assistant", content: progressData });
        }
        if (
            existVoice &&
            enableAutoVoice &&
            currentVoiceIdx === autoVoiceDataIdx &&
            progressData.length
        ) {
            let voiceText = progressData.slice(autoVoiceIdx);
            autoSpeechEvent(voiceText, currentResEle, false, true);
        }
    }
    updateChats();
    controllerId = delayId = refreshIdx = void 0;
    autoVoiceIdx = 0;
    currentResEle.dataset.loading = false;
    currentResEle = null;
    progressData = "";
    loadAction(false);
};
const generateText = async (message) => {
    loadAction(true);
    let requestEle = createConvEle("request");
    requestEle.children[0].innerHTML = md.render(message);
    data.push({ role: "user", content: message });
    if (chatsData[activeChatIdx].name === "新的会话") {
        if (message.length > 50) {
            message = message.slice(0, 47) + "...";
        }
        chatsData[activeChatIdx].name = message;
        chatListEle.children[activeChatIdx].children[1].textContent = message;
    }
    updateChats();
    scrollToBottom();
    await streamGen();
};
textarea.onkeydown = (e) => {
    if (e.keyCode === 13 && !e.shiftKey) {
        e.preventDefault();
        genFunc();
    }
};
const genFunc = function () {
    
    if (recing) {
        toggleRecEv();
    }
    let message = textarea.value.trim();
    if (message.length !== 0) {
        if (loading === true) return;
        textarea.value = "";
        textarea.style.height = "47px";
        generateText(message);
    }
};
sendBtnEle.onclick = genFunc;
stopEle.onclick = stopLoading;
document.getElementById("clearConv").onclick = () => {
    if (!loading && confirmAction("是否清空会话?")) {
        endSpeak();
        if (systemRole) {
            data.length = 1;
        } else {
            data.length = 0;
        }
        chatlog.innerHTML = "";
        updateChats();
    }
};