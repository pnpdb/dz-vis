import { defineStore } from 'pinia';

const filePath = localStorage.getItem('filePath') || '';

export const useCarStore = defineStore('car', {
    state: () => ({
        filePath,
        selectedCarId: 1,
        carList: [
            {
                id: 1,
                name: '车辆A',
                value: 1,
                position: {
                    x: 100,
                    y: 100,
                },
                angle: 0,
                speed: 20,
                batteryValue: 82,
                isNav: true,
                loop: 75,
                online: true,
            },
            {
                id: 2,
                name: '车辆B',
                value: 2,
            },
            {
                id: 3,
                name: '车辆C',
                value: 3,
            },
            {
                id: 4,
                name: '车辆D',
                value: 4,
            },
            {
                id: 5,
                name: '车辆E',
                value: 5,
            },
        ],
        count: 0,
        name: 'Eduardo',
    }),
    getters: {
        selectedCar: state => {
            const car = state.carList.find(
                car => car.id === state.selectedCarId
            );
            return car;
        },
    },
    actions: {
        changeCarId(id) {
            this.selectedCarId = id;
        },
    },
});