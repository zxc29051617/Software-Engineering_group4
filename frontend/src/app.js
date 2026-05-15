const screenNumber = document.getElementById("screenNumber");
const screenStatus = document.getElementById("screenStatus");
const brandTitle = document.getElementById("brandTitle");
const primaryAction = document.getElementById("primaryAction");
const countForm = document.getElementById("countForm");
const countInput = document.getElementById("countInput");
const valuesForm = document.getElementById("valuesForm");
const valueInputs = document.getElementById("valueInputs");
const barArea = document.getElementById("barArea");
const errorOverlay = document.getElementById("errorOverlay");
const errorMessage = document.getElementById("errorMessage");
const closeError = document.getElementById("closeError");

const state = {
  screen: "start",
  count: 0,
  numbers: [],
  sorter: null,
  timerId: null,
  lastStep: null,
};

const screenMeta = {
  start: ["STATUS", "START"],
  input: ["STATUS", "INPUT"],
  ready: ["STATUS", "INPUT"],
  error: ["STATUS", "VALIDATION ERROR"],
  readyToSort: ["STATUS", "READY TO SORT"],
  sorting: ["STATUS", "SORTING"],
  finished: ["STATUS", "FINISHED"],
};

class BubbleSortVisualizer {
  constructor(inputArray) {
    this.arr = [...inputArray];
    this.i = 0;
    this.j = 0;
    this.finished = inputArray.length <= 1;
  }

  nextStep() {
    if (this.finished) {
      return {
        done: true,
        array: [...this.arr],
        currentCompare: [],
        swapped: false,
      };
    }

    const left = this.j;
    const right = this.j + 1;
    let swapped = false;

    if (this.arr[left] > this.arr[right]) {
      [this.arr[left], this.arr[right]] = [this.arr[right], this.arr[left]];
      swapped = true;
    }

    this.j += 1;

    if (this.j >= this.arr.length - this.i - 1) {
      this.j = 0;
      this.i += 1;
    }

    if (this.i >= this.arr.length - 1) {
      this.finished = true;
    }

    return {
      done: this.finished,
      array: [...this.arr],
      currentCompare: [left, right],
      swapped,
    };
  }
}

function isIntegerInRange(value, min, max) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max;
}

function setScreen(screen) {
  state.screen = screen;
  const [number, status] = screenMeta[screen];
  screenNumber.textContent = number;
  screenStatus.textContent = status;
}

function setPrimaryAction(label, className, disabled = false) {
  primaryAction.textContent = label;
  primaryAction.className = `primary-button ${className}`;
  primaryAction.disabled = disabled;
}

function showOnly(panelName) {
  countForm.classList.toggle("hidden", panelName !== "count");
  valuesForm.classList.toggle("hidden", panelName !== "values");
  barArea.classList.toggle("hidden", panelName !== "bars");
}

function resetBrand() {
  brandTitle.classList.remove("success-title");
  brandTitle.innerHTML = "<span>BUBBLE</span><span>SORT</span><span>VISUALIZER</span>";
}

function createInputs(count) {
  valueInputs.innerHTML = "";
  valueInputs.style.setProperty("--input-count", count);
  valueInputs.style.setProperty("--mobile-count", Math.min(count, 5));

  for (let index = 0; index < count; index += 1) {
    const input = document.createElement("input");
    input.className = "number-input";
    input.type = "number";
    input.min = "1";
    input.max = "10";
    input.inputMode = "numeric";
    input.autocomplete = "off";
    input.placeholder = "0";
    input.setAttribute("aria-label", `Number ${index + 1}`);
    valueInputs.appendChild(input);
  }
}

function getNumberInputs() {
  return [...valueInputs.querySelectorAll(".number-input")];
}

function updateInputState() {
  const inputs = getNumberInputs();
  let allFilled = true;
  let allValid = true;

  inputs.forEach((input) => {
    const hasValue = input.value.trim() !== "";
    const valid = hasValue && isIntegerInRange(input.value, 1, 10);
    allFilled = allFilled && hasValue;
    allValid = allValid && valid;
    input.classList.toggle("valid", valid);
    input.classList.toggle("invalid", hasValue && !valid);
  });

  if (allFilled) {
    setScreen("ready");
    setPrimaryAction("VALIDATE", "green-button", false);
  } else {
    setScreen("input");
    setPrimaryAction("VALIDATE", "green-button", true);
  }

  return allFilled && allValid;
}

function showError(message) {
  setScreen("error");
  errorMessage.textContent = message;
  errorOverlay.classList.remove("hidden");
}

function closeErrorModal() {
  errorOverlay.classList.add("hidden");
  resetApp();
}

function renderBars(numbers, options = {}) {
  const compare = options.compare || [];
  const swapped = options.swapped || false;
  const sorted = options.sorted || false;
  const maxValue = Math.max(...numbers, 10);

  barArea.innerHTML = "";
  barArea.style.setProperty("--bar-count", numbers.length);
  barArea.style.setProperty("--mobile-count", Math.min(numbers.length, 5));

  numbers.forEach((number, index) => {
    const bar = document.createElement("div");
    const height = 34 + (number / maxValue) * 148;
    bar.className = "bar";
    bar.style.height = `${height}px`;
    bar.textContent = number;

    if (sorted) {
      bar.classList.add("sorted");
    } else if (compare.includes(index)) {
      bar.classList.add("compare");
      if (swapped) {
        bar.classList.add("swapped");
      }
    }

    barArea.appendChild(bar);
  });
}

function confirmCount() {
  if (!isIntegerInRange(countInput.value, 2, 10)) {
    showError("Input Error: Please enter a number from 2 to 10.");
    return;
  }

  state.count = Number(countInput.value);
  resetBrand();
  createInputs(state.count);
  showOnly("values");
  setScreen("input");
  setPrimaryAction("VALIDATE", "green-button", true);
}

function validateNumbers() {
  const inputs = getNumberInputs();
  const invalidInput = inputs.find((input) => !isIntegerInRange(input.value, 1, 10));

  if (invalidInput) {
    invalidInput.classList.add("invalid");
    showError(`Input Error: "${invalidInput.value || "blank"}" is not a valid number from 1 to 10.`);
    return;
  }

  state.numbers = inputs.map((input) => Number(input.value));
  showOnly("bars");
  setScreen("readyToSort");
  setPrimaryAction("SORT", "red-button", false);
  renderBars(state.numbers);
}

function startSort() {
  clearInterval(state.timerId);
  state.sorter = new BubbleSortVisualizer(state.numbers);
  state.lastStep = null;
  setScreen("sorting");
  setPrimaryAction("SORTING...", "red-button", true);

  state.timerId = setInterval(() => {
    const step = state.sorter.nextStep();
    state.lastStep = step;
    renderBars(step.array, {
      compare: step.currentCompare,
      swapped: step.swapped,
      sorted: false,
    });

    if (step.done) {
      clearInterval(state.timerId);
      state.numbers = step.array;
      finishSort();
    }
  }, 650);
}

function finishSort() {
  setScreen("finished");
  brandTitle.classList.add("success-title");
  brandTitle.innerHTML = "<span>SORTING</span><span>SUCCESSFUL!</span>";
  setPrimaryAction("PLAY AGAIN?", "green-button", false);
  renderBars(state.numbers, { sorted: true });
}

function resetApp() {
  clearInterval(state.timerId);
  state.count = 0;
  state.numbers = [];
  state.sorter = null;
  state.lastStep = null;
  countInput.value = "";
  valueInputs.innerHTML = "";
  barArea.innerHTML = "";
  resetBrand();
  showOnly("count");
  setScreen("start");
  setPrimaryAction("CONFIRM", "red-button", false);
  countInput.focus();
}

primaryAction.addEventListener("click", () => {
  if (state.screen === "start") {
    confirmCount();
    return;
  }

  if (state.screen === "input" || state.screen === "ready") {
    validateNumbers();
    return;
  }

  if (state.screen === "readyToSort") {
    startSort();
    return;
  }

  if (state.screen === "finished") {
    resetApp();
  }
});

countForm.addEventListener("submit", (event) => {
  event.preventDefault();
  confirmCount();
});

valuesForm.addEventListener("submit", (event) => {
  event.preventDefault();
  validateNumbers();
});

valueInputs.addEventListener("input", updateInputState);

closeError.addEventListener("click", closeErrorModal);

errorOverlay.addEventListener("click", (event) => {
  if (event.target === errorOverlay) {
    closeErrorModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !errorOverlay.classList.contains("hidden")) {
    closeErrorModal();
  }
});

resetApp();
