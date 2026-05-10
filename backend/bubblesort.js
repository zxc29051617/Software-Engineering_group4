function isValidNumber(num) {

    num = Number(num);

    if (!Number.isInteger(num)) {
        return false;
    }

    if (num < 1 || num > 10) {
        return false;
    }
    return true;
}

class BubbleSortVisualizer {
    constructor(inputArray) {
        this.arr = [...inputArray];
        this.i = 0;
        this.j = 0;
        this.finished = false;
    }

    
    nextStep() {

        if (this.finished) {
            return {
                done: true,
                array: [...this.arr],
            };
        }

        const n = this.arr.length;

        if (this.arr[this.j] > this.arr[this.j + 1]) {

            [this.arr[this.j], this.arr[this.j + 1]] =
            [this.arr[this.j + 1], this.arr[this.j]];
        }

        this.j++;

        if (this.j >= n - this.i - 1) {
            this.j = 0;
            this.i++;
        }

        if (this.i >= n - 1) {
            this.finished = true;
        }

        return {
            done: this.finished,
            array: [...this.arr],
            currentCompare: [this.j, this.j + 1],
        };
    }
}


