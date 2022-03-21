export function renderError(err: string, el: HTMLElement, extra?: string) {
    const wrapper = document.createElement("div");

    const message = document.createElement("strong");
    message.innerText = "Desmos Graph Error: ";
    wrapper.appendChild(message);

    const ctx = document.createElement("span");
    ctx.innerText = err;
    wrapper.appendChild(ctx);

    if (extra) {
        const message_extra = document.createElement("strong");
        message_extra.innerHTML = "<br>Note: ";
        wrapper.appendChild(message_extra);

        const ctx_extra = document.createElement("span");
        ctx_extra.innerHTML = extra; // the `extra` argument is only supplied by a static string internally, so this is safe
        wrapper.appendChild(ctx_extra);
    }

    const container = document.createElement("div");
    container.style.padding = "20px";
    container.style.backgroundColor = "#f44336";
    container.style.color = "white";
    container.appendChild(wrapper);

    el.empty();
    el.appendChild(container);
}
