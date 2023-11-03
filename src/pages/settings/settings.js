document.querySelectorAll("[data-opt]").forEach(i => {
    i[i.getAttribute("data-opt-attr") ?? "value"] = engineSettings[i.getAttribute("data-opt")];
});

window.saveSettings = () => {
    document.querySelectorAll("[data-opt]").forEach(i => {
        engineSettings[i.getAttribute("data-opt")] = i[i.getAttribute("data-opt-attr") ?? "value"];
    });
    saveEngineSettings();
    setPopupText("Successfully saved settings!");
    showPopup();
};