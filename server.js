const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const TOTAL_SEATS = 25;
let seats = new Array(TOTAL_SEATS).fill(null);
let isBookingOpen = false; // ★ 티케팅 시작 여부 상태 변수 (기본값: 닫힘)

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log(`새 사용자 접속: ${socket.id}`);

    // 접속 시 현재 전체 좌석 상태 및 티케팅 오픈 여부 전달
    socket.emit('initSeats', { seats, isBookingOpen });

    // 좌석 선점 요청 처리
    socket.on('requestSeat', (data) => {
        // ★ 0. 티케팅 오픈 여부 체크
        if (!isBookingOpen) {
            socket.emit('bookingResult', { success: false, message: '아직 좌석 선택이 시작되지 않았습니다!' });
            return;
        }

        const { seatIndex, studentName, studentId } = data;

        if (seatIndex < 0 || seatIndex >= TOTAL_SEATS) {
            socket.emit('bookingResult', { success: false, message: '잘못된 좌석 번호입니다.' });
            return;
        }

        const alreadyBooked = seats.findIndex(s => s && s.studentId === studentId);
        if (alreadyBooked !== -1) {
            socket.emit('bookingResult', { 
                success: false, 
                message: `이미 ${alreadyBooked + 1}번 좌석을 선점하셨습니다.` 
            });
            return;
        }

        if (seats[seatIndex] !== null) {
            socket.emit('bookingResult', { 
                success: false, 
                message: '이미 선점된 좌석입니다. 다른 자리를 선택해 주세요.' 
            });
            return;
        }

        seats[seatIndex] = {
            studentId,
            studentName,
            socketId: socket.id,
            timestamp: new Date()
        };

        socket.emit('bookingResult', { 
            success: true, 
            seatIndex: seatIndex,
            message: `${seatIndex + 1}번 좌석 선점에 성공했습니다!` 
        });

        io.emit('seatUpdated', { seatIndex, seatInfo: seats[seatIndex] });
    });

    // ★ 선생님 전용: 티케팅 시작 / 마감 제어
    socket.on('toggleBooking', (data) => {
        if (data.adminPassword === "1234") {
            isBookingOpen = data.openState;
            io.emit('bookingStatusChanged', { isBookingOpen }); // 모든 학생 화면에 상태 즉시 브로드캐스트
            const msg = isBookingOpen ? '티케팅이 시작되었습니다!' : '티케팅이 마감되었습니다.';
            socket.emit('adminResult', { success: true, message: msg });
        } else {
            socket.emit('adminResult', { success: false, message: '비밀번호가 일치하지 않습니다.' });
        }
    });

    // 선생님 전용: 좌석 전체 초기화
    socket.on('resetSeats', (data) => {
        if (data.adminPassword === "1234") {
            seats = new Array(TOTAL_SEATS).fill(null);
            isBookingOpen = false; // 초기화 시 티케팅 상태도 다시 '닫힘'으로 변경
            io.emit('initSeats', { seats, isBookingOpen });
            socket.emit('adminResult', { success: true, message: '모든 좌석이 초기화되었습니다.' });
        } else {
            socket.emit('adminResult', { success: false, message: '비밀번호가 일치하지 않습니다.' });
        }
    });

    socket.on('disconnect', () => {
        console.log(`접속 종료: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});