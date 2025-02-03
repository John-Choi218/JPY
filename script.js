// 투자 데이터를 저장할 배열들
let currentInvestments = [];
let completedInvestments = [];

// Firebase 초기화
const firebaseConfig = {
    apiKey: "AIzaSyDNH3kgVbLnf-1-htdxoSvSYpZu2yQKtKg",
    authDomain: "jpyi-dbeb8.firebaseapp.com",
    projectId: "jpyi-dbeb8",
    storageBucket: "jpyi-dbeb8.firebasestorage.app",
    messagingSenderId: "453717733641",
    appId: "1:453717733641:web:260fb49f655fef4fd663d8"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 데이터 로드
async function loadData() {
    try {
        // 현재 투자 데이터 로드
        const currentSnapshot = await db.collection('currentInvestments').get();
        currentInvestments = currentSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // 완료된 투자 데이터 로드
        const completedSnapshot = await db.collection('completedInvestments').get();
        completedInvestments = completedSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        updateTables();
        updateSummary();
    } catch (error) {
        console.error('데이터 로드 실패:', error);
        alert('데이터 로드에 실패했습니다.');
    }
}

// 데이터 저장
function saveData() {
    localStorage.setItem('currentInvestments', JSON.stringify(currentInvestments));
    localStorage.setItem('completedInvestments', JSON.stringify(completedInvestments));
}

// 새로운 투자 추가
document.getElementById('investmentForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const purchaseDate = document.getElementById('purchaseDate').value;
    const amountYen = Number(document.getElementById('amountYen').value);
    const exchangeRate = Number(document.getElementById('exchangeRate').value);
    
    const investment = {
        id: Date.now(),
        date: new Date(purchaseDate).toISOString(),
        amountYen: amountYen,
        exchangeRate: exchangeRate,
        amountKrw: amountYen * exchangeRate
    };
    
    currentInvestments.push(investment);
    saveData();
    updateTables();
    
    // 폼 초기화
    this.reset();
});

// 투자 수정
function editInvestment(id) {
    const investment = currentInvestments.find(inv => inv.id === id);
    if (!investment) return;
    
    // 수정할 데이터를 폼에 채우기
    document.getElementById('purchaseDate').value = new Date(investment.date).toISOString().split('T')[0];
    document.getElementById('amountYen').value = investment.amountYen;
    document.getElementById('exchangeRate').value = investment.exchangeRate;
    
    // 기존 데이터 삭제
    currentInvestments = currentInvestments.filter(inv => inv.id !== id);
    
    // 수정 모드임을 표시
    document.getElementById('investmentForm').dataset.editMode = id;
    document.querySelector('#investmentForm button[type="submit"]').textContent = '수정';
    
    // 수정 취소 버튼 추가
    if (!document.getElementById('cancelEdit')) {
        const cancelButton = document.createElement('button');
        cancelButton.id = 'cancelEdit';
        cancelButton.type = 'button';
        cancelButton.textContent = '취소';
        cancelButton.onclick = cancelEdit;
        document.getElementById('investmentForm').appendChild(cancelButton);
    }
}

// 수정 취소
function cancelEdit() {
    document.getElementById('investmentForm').reset();
    document.getElementById('investmentForm').removeAttribute('data-edit-mode');
    document.querySelector('#investmentForm button[type="submit"]').textContent = '추가';
    document.getElementById('cancelEdit').remove();
    loadData();
}

// 투자 삭제
function deleteInvestment(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    currentInvestments = currentInvestments.filter(inv => inv.id !== id);
    saveData();
    updateTables();
}

// 투자 매도
function sellInvestment(id) {
    const investment = currentInvestments.find(inv => inv.id === id);
    if (!investment) return;
    
    // 모바일 친화적인 입력 폼 생성
    const sellRate = prompt('매도 환율을 입력하세요:', '');
    if (!sellRate) return;
    
    const sellExchangeRate = Number(sellRate);
    if (isNaN(sellExchangeRate) || sellExchangeRate <= 0) {
        alert('올바른 환율을 입력해주세요.');
        return;
    }
    
    const sellAmountKrw = investment.amountYen * sellExchangeRate;
    const profitLoss = sellAmountKrw - investment.amountKrw;
    const profitLossRate = (profitLoss / investment.amountKrw) * 100;
    
    const completedInvestment = {
        ...investment,
        sellDate: new Date().toISOString(),
        sellExchangeRate: sellExchangeRate,
        sellAmountKrw: sellAmountKrw,
        profitLoss: profitLoss,
        profitLossRate: profitLossRate
    };
    
    completedInvestments.push(completedInvestment);
    currentInvestments = currentInvestments.filter(inv => inv.id !== id);
    
    saveData();
    updateTables();
    updateSummary();
}

// 테이블 업데이트
function updateTables() {
    // 현재 투자 테이블 업데이트
    const currentTable = document.querySelector('#currentInvestmentsTable tbody');
    currentTable.innerHTML = currentInvestments.map(inv => `
        <tr>
            <td>${new Date(inv.date).toLocaleDateString()}</td>
            <td>${inv.amountYen.toLocaleString()}엔</td>
            <td>${inv.exchangeRate.toFixed(4)}원</td>
            <td>${inv.amountKrw.toLocaleString()}원</td>
            <td>
                <div class="button-group">
                    <button class="edit-button" onclick="editInvestment(${inv.id})">수정</button>
                    <button class="delete-button" onclick="deleteInvestment(${inv.id})">삭제</button>
                    <button class="sell-button" onclick="sellInvestment(${inv.id})">매도</button>
                </div>
            </td>
        </tr>
    `).join('');
    
    // 투자 실적 테이블 업데이트
    const historyTable = document.querySelector('#historyTable tbody');
    historyTable.innerHTML = completedInvestments.map(inv => `
        <tr>
            <td>${new Date(inv.date).toLocaleDateString()}</td>
            <td>${new Date(inv.sellDate).toLocaleDateString()}</td>
            <td>${inv.amountYen.toLocaleString()}엔</td>
            <td>${inv.exchangeRate.toFixed(4)}원</td>
            <td>${inv.sellExchangeRate.toFixed(4)}원</td>
            <td>${inv.profitLoss.toLocaleString()}원</td>
            <td>${inv.profitLossRate.toFixed(2)}%</td>
        </tr>
    `).join('');
}

// 요약 정보 업데이트
function updateSummary() {
    const totalProfit = completedInvestments.reduce((sum, inv) => sum + inv.profitLoss, 0);
    const averageReturn = completedInvestments.length > 0
        ? completedInvestments.reduce((sum, inv) => sum + inv.profitLossRate, 0) / completedInvestments.length
        : 0;
    
    document.getElementById('totalProfit').textContent = `${totalProfit.toLocaleString()}원`;
    document.getElementById('averageReturn').textContent = `${averageReturn.toFixed(2)}%`;
}

// 초기 데이터 로드
loadData();
