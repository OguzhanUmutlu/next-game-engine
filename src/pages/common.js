addEventListener("keydown", e => e.key === "F5" && location.reload());
const popupContainer = document.getElementById("p-con");

window.INVALID_NAME_REGEXP = /[\/\\"'*;\-?\[\]()~!${}<>#@&|\t\n\r]+/g;
window.VALID_NAME_REGEXP = /^[^\/\\"'*;\-?\[\]()~!${}<>#@&|\t\n\r]+$/;
const loadPromise = new Promise(r => addEventListener("load", r));
window.waitFrame = () => new Promise(r => requestAnimationFrame(r));
window.waitTick = () => new Promise(r => setTimeout(r));
window.waitLoad = () => loadPromise;

const defaultSettings = {
    pageTransition: true,
    globalTransition: true,
    monacoEditor: true,
    codeTransition: false
};
window.engineSettings = {
    ...defaultSettings, ...JSON.parse(localStorage.getItem("settings") ?? "{}")
};
window.saveEngineSettings = () => {
    localStorage.setItem("settings", JSON.stringify(engineSettings));
};

if (!engineSettings.globalTransition) {
    document.querySelector(":root").style.setProperty("--global-transition", "none");
}

if (!engineSettings.pageTransition) {
    document.querySelector(":root").style.setProperty("--global-transition", "none");
    document.body.style.opacity = "1";
    document.body.style.translate = "0";
}

if (!engineSettings.codeTransition) {
    document.querySelector(":root").style.setProperty("--code-transition", "none");
}

window.redirectTo = (page, extra = "") => {
    document.body.style.translate = "500px";
    document.body.style.opacity = "0";
    document.body.style.pointerEvents = "none";
    const url = "../" + page + "/" + page + ".html" + extra;
    setTimeout(() => {
        location.href = url;
    }, engineSettings.pageTransition ? 200 : 0);
    return url;
};

window.setPopupText = (html, buttons = [["Close", hidePopup]]) => {
    const popup = popupContainer.querySelector(".popup");
    popup.innerHTML = html;
    if (buttons.length > 0) {
        popup.innerHTML += `<br>`;
        const btnL = document.createElement("div");
        btnL.style.display = "flex";
        for (let i = 0; i < buttons.length; i++) {
            const b = buttons[i];
            const btn = document.createElement("div");
            btn.classList.add("btn");
            btn.style.margin = "10px";
            btn.innerText = b[0];
            if (b[2]) btn.style.background = b[2];
            btn.addEventListener("click", () => b[1]());
            btnL.appendChild(btn);
        }
        popup.appendChild(btnL);
    }
};

window.showPopup = () => {
    popupContainer.style.pointerEvents = "all";
    popupContainer.style.opacity = "1";
};

window.hidePopup = () => {
    popupContainer.style.pointerEvents = "none";
    popupContainer.style.opacity = "0";
};

window.formatTime = ms => {
    const d = new Date(ms);
    return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear() + " " + d.getHours() + ":" + d.getMinutes();
};

await waitLoad();
if (engineSettings.globalTransition) {
    document.querySelector(":root").style.setProperty("--global-transition", "all .2s");
}

window.settingsPopup = async () => {
    setPopupText("<label><input type='checkbox' data-opt='pageTransition' data-opt-attr='checked' spellCheck='false'> Page transition</label><br>" +
        "<label><input type='checkbox' data-opt='globalTransition' data-opt-attr='checked' spellCheck='false'> Global transition</label><br>" +
        "<label><input type='checkbox' data-opt='monacoEditor' data-opt-attr='checked' spellCheck='false'> Monaco Editor</label><br>" +
        "<label><input type='checkbox' data-opt='codeTransition' data-opt-attr='checked' spellCheck='false'> Code transition</label>", [
        ["Cancel", hidePopup],
        ["Save settings", async () => {
            let upd = false;
            document.querySelectorAll("[data-opt]").forEach(i => {
                const n = i.getAttribute("data-opt");
                const v = i[i.getAttribute("data-opt-attr") ?? "value"];
                if (engineSettings[n] !== v) {
                    engineSettings[n] = v;
                    upd = true;
                }
            });
            saveEngineSettings();
            setPopupText("Successfully saved settings!", [
                ["Close", () => {
                    hidePopup();
                    if (upd) location.reload();
                }]
            ]);
        }, "#25e025"]
    ]);
    showPopup();
    document.querySelectorAll("[data-opt]").forEach(i => {
        i[i.getAttribute("data-opt-attr") ?? "value"] = engineSettings[i.getAttribute("data-opt")];
    });
};

document.body.style.translate = "0";
document.body.style.opacity = "1";
document.body.style.pointerEvents = "auto";