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
document.getElementById('investmentForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const purchaseDate = document.getElementById('purchaseDate').value;
    const amountYen = Number(document.getElementById('amountYen').value);
    const exchangeRate = Number(document.getElementById('exchangeRate').value);
    
    // 100엔 단위로 계산
    const amountKrw = (amountYen / 100) * exchangeRate;
    
    const investment = {
        date: new Date(purchaseDate).toISOString(),
        amountYen: amountYen,
        exchangeRate: exchangeRate,
        amountKrw: amountKrw
    };
    
    try {
        await db.collection('currentInvestments').add(investment);
        await loadData();
        this.reset();
    } catch (error) {
        console.error('투자 추가 실패:', error);
        alert('투자 추가에 실패했습니다.');
    }
});

// 투자 수정
async function editInvestment(id) {
    const investment = currentInvestments.find(inv => inv.id === id);
    if (!investment) return;
    
    document.getElementById('purchaseDate').value = new Date(investment.date).toISOString().split('T')[0];
    document.getElementById('amountYen').value = investment.amountYen;
    document.getElementById('exchangeRate').value = investment.exchangeRate;
    
    document.getElementById('investmentForm').dataset.editMode = id;
    document.querySelector('#investmentForm button[type="submit"]').textContent = '수정';
    
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
async function sellInvestment(id) {
    const investment = currentInvestments.find(inv => inv.id === id);
    if (!investment) return;
    
    const sellRate = prompt('매도 환율을 입력하세요 (100엔 기준):', '');
    if (!sellRate) return;
    
    const sellExchangeRate = Number(sellRate);
    if (isNaN(sellExchangeRate) || sellExchangeRate <= 0) {
        alert('올바른 환율을 입력해주세요.');
        return;
    }
    
    // 100엔 단위로 계산
    const sellAmountKrw = (investment.amountYen / 100) * sellExchangeRate;
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
    
    try {
        await db.runTransaction(async (transaction) => {
            await transaction.delete(db.collection('currentInvestments').doc(id));
            await transaction.set(db.collection('completedInvestments').doc(), completedInvestment);
        });
        
        await loadData();
    } catch (error) {
        console.error('매도 처리 실패:', error);
        alert('매도 처리에 실패했습니다.');
    }
}

// 테이블 업데이트
function updateTables() {
    // 현재 투자 테이블 업데이트
    const currentTable = document.querySelector('#currentInvestmentsTable tbody');
    currentTable.innerHTML = currentInvestments.map(inv => {
        const amountYen100 = inv.amountYen.toLocaleString(); // 100엔 단위로 표시
        const amountKrw = inv.amountKrw.toLocaleString(); // 원화 금액
        
        return `
        <tr>
            <td>${new Date(inv.date).toLocaleDateString()}</td>
            <td>${amountYen100}엔</td>
            <td>${inv.exchangeRate.toFixed(2)}원</td>
            <td>${amountKrw}원</td>
            <td>
                <div class="button-group">
                    <button class="edit-button" onclick="editInvestment('${inv.id}')">수정</button>
                    <button class="delete-button" onclick="deleteInvestment('${inv.id}')">삭제</button>
                    <button class="sell-button" onclick="sellInvestment('${inv.id}')">매도</button>
                </div>
            </td>
        </tr>
    `}).join('');
    
    // 투자 실적 테이블 업데이트
    const historyTable = document.querySelector('#historyTable tbody');
    historyTable.innerHTML = completedInvestments.map(inv => {
        const amountYen100 = inv.amountYen.toLocaleString(); // 100엔 단위로 표시
        
        return `
        <tr>
            <td>${new Date(inv.date).toLocaleDateString()}</td>
            <td>${new Date(inv.sellDate).toLocaleDateString()}</td>
            <td>${amountYen100}엔</td>
            <td>${inv.exchangeRate.toFixed(2)}원</td>
            <td>${inv.sellExchangeRate.toFixed(2)}원</td>
            <td>${inv.profitLoss.toLocaleString()}원</td>
            <td>${inv.profitLossRate.toFixed(2)}%</td>
        </tr>
    `}).join('');
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

// 입력 폼 HTML도 수정이 필요합니다
document.getElementById('amountYen').placeholder = '100엔 단위로 입력';
