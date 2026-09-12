const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const TOTAL_SEATS = 25;

// 메모리 내 좌석 상태 저장
// null: 빈자리, 객체: 선점 정보 { studentId, studentName, socketId }
let seats = new Array(TOTAL_SEATS).fill(null);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log(`새 사용자 접속: ${socket.id}`);

    // 접속 시 현재 전체 좌석 상태 전송
    socket.emit('initSeats', seats);

    // 좌석 선점 요청 처리 (동시성 제어)
    socket.on('requestSeat', (data) => {
        const { seatIndex, studentName, studentId } = data;

        // 1. 좌석 범위 유효성 체크
        if (seatIndex < 0 || seatIndex >= TOTAL_SEATS) {
            socket.emit('bookingResult', { success: false, message: '잘못된 좌석 번호입니다.' });
            return;
        }

        // 2. 동일 학생 중복 선점 방지 (1인 1좌석 제한)
        const alreadyBooked = seats.findIndex(s => s && s.studentId === studentId);
        if (alreadyBooked !== -1) {
            socket.emit('bookingResult', { 
                success: false, 
                message: `이미 ${alreadyBooked + 1}번 좌석을 선점하셨습니다.` 
            });
            return;
        }

        // 3. 클릭 시점에 이미 다른 사람이 선점했는지 검수
        if (seats[seatIndex] !== null) {
            socket.emit('bookingResult', { 
                success: false, 
                message: '이미 선점된 좌석입니다. 다른 자리를 선택해 주세요.' 
            });
            return;
        }

        // 4. 선점 성공 처리
        seats[seatIndex] = {
            studentId,
            studentName,
            socketId: socket.id,
            timestamp: new Date()
        };

        // 요청 클라이언트에 성공 알림
        socket.emit('bookingResult', { 
            success: true, 
            seatIndex: seatIndex,
            message: `${seatIndex + 1}번 좌석 선점에 성공했습니다!` 
        });

        // 접속한 전체 사용자 화면의 좌석 실시간 갱신 브로드캐스트
        io.emit('seatUpdated', { seatIndex, seatInfo: seats[seatIndex] });
    });

    socket.on('disconnect', () => {
        console.log(`접속 종료: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});