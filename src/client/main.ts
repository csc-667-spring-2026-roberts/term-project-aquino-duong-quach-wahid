const button = document.getElementById("loadData") as HTMLButtonElement;
const container = document.getElementById("dataContainer") as HTMLDivElement;
const template = document.getElementById("dataTemplate") as HTMLTemplateElement;

button?.addEventListener("click", async () => {
  const res = await fetch("/test/data");
  const data = await res.json();

  container.innerHTML = "";

  data.forEach((item: { message: string }) => {
    const clone = template.content.cloneNode(true) as DocumentFragment;

    const text = clone.querySelector(".message") as HTMLElement;
    text.textContent = item.message;

    container.appendChild(clone);
  });
});