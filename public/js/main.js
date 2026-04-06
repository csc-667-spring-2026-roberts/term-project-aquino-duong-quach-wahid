"use strict";
(() => {
  // src/client/main.ts
  var button = document.getElementById("loadData");
  var container = document.getElementById("dataContainer");
  var template = document.getElementById("dataTemplate");
  button?.addEventListener("click", async () => {
    const res = await fetch("/test/data");
    const data = await res.json();
    container.innerHTML = "";
    data.forEach((item) => {
      const clone = template.content.cloneNode(true);
      const text = clone.querySelector(".message");
      text.textContent = item.message;
      container.appendChild(clone);
    });
  });
})();
