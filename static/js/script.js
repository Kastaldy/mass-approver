document.addEventListener('DOMContentLoaded', function() {
    // Elementos DOM
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    const selectedFile = document.getElementById('selectedFile');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const resultsCard = document.getElementById('resultsCard');
    const resultsBody = document.getElementById('resultsBody');
    const statsContainer = document.getElementById('statsContainer');
    const downloadBtn = document.getElementById('downloadBtn');
    const loading = document.getElementById('loading');
    const messageContainer = document.getElementById('messageContainer');
    
    let currentResults = null;
    
    // Evento de upload
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#4f46e5';
        uploadArea.style.background = '#f8fafc';
    });
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '#cbd5e1';
        uploadArea.style.background = 'white';
    });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#cbd5e1';
        uploadArea.style.background = 'white';
        
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            updateSelectedFile();
        }
    });
    
    fileInput.addEventListener('change', updateSelectedFile);
    
    function updateSelectedFile() {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            selectedFile.innerHTML = `
                <i class="fas fa-file-excel"></i>
                <span>${file.name} (${formatFileSize(file.size)})</span>
            `;
            selectedFile.style.display = 'block';
        } else {
            selectedFile.style.display = 'none';
        }
    }
    
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Evento de análise
    analyzeBtn.addEventListener('click', async () => {
        if (!fileInput.files.length) {
            showMessage('Por favor, selecione um arquivo primeiro.', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        formData.append('regua_renda', document.getElementById('regua_renda').value);
        formData.append('regua_pea', document.getElementById('regua_pea').value);
        formData.append('regua_densidade', document.getElementById('regua_densidade').value);
        
        showLoading(true);
        clearMessages();
        
        try {
            const response = await fetch('/analisar', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.sucesso) {
                currentResults = data.resultados;
                displayResults(data.resultados, data.estatisticas);
                showMessage('Análise concluída com sucesso!', 'success');
            } else {
                showMessage(data.erro || 'Erro na análise.', 'error');
            }
        } catch (error) {
            showMessage('Erro de conexão: ' + error.message, 'error');
        } finally {
            showLoading(false);
        }
    });
    
    // Evento de download
    downloadBtn.addEventListener('click', async () => {
        if (!currentResults) {
            showMessage('Nenhum resultado para baixar.', 'error');
            return;
        }
        
        showLoading(true);
        
        try {
            const response = await fetch('/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ resultados: currentResults })
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'resultados_analise.xlsx';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                showMessage('Download iniciado!', 'success');
            } else {
                const error = await response.json();
                showMessage(error.erro || 'Erro ao baixar.', 'error');
            }
        } catch (error) {
            showMessage('Erro de conexão: ' + error.message, 'error');
        } finally {
            showLoading(false);
        }
    });
    
    // Funções auxiliares
    function displayResults(resultados, estatisticas) {
        // Mostrar card de resultados
        resultsCard.style.display = 'block';
        
        // Exibir estatísticas
        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${estatisticas.total}</div>
                <div class="stat-label">Total Endereços</div>
            </div>
            <div class="stat-card aprovado">
                <div class="stat-value">${estatisticas.aprovados}</div>
                <div class="stat-label">Aprovados</div>
                <div class="stat-percent">${estatisticas.taxa_aprovacao}</div>
            </div>
            <div class="stat-card parcial">
                <div class="stat-value">${estatisticas.parciais}</div>
                <div class="stat-label">Parciais</div>
                <div class="stat-percent">${estatisticas.taxa_parciais}</div>
            </div>
            <div class="stat-card reprovado">
                <div class="stat-value">${estatisticas.reprovados}</div>
                <div class="stat-label">Reprovados</div>
                <div class="stat-percent">${estatisticas.taxa_reprovacao}</div>
            </div>
        `;
        
        // Exibir tabela
        resultsBody.innerHTML = '';
        
        resultados.forEach(resultado => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-status', resultado.status_class);
            
            tr.innerHTML = `
                <td title="${resultado.endereco}">${truncateText(resultado.endereco, 60)}</td>
                <td>R$ ${formatNumber(resultado.renda_media)}</td>
                <td>${formatNumber(resultado.pea_dia)}</td>
                <td>${formatNumber(resultado.densidade)}</td>
                <td class="${resultado.acima_renda === '✓' ? 'aprovado' : 'reprovado'}">${resultado.acima_renda}</td>
                <td class="${resultado.acima_pea === '✓' ? 'aprovado' : 'reprovado'}">${resultado.acima_pea}</td>
                <td class="${resultado.acima_densidade === '✓' ? 'aprovado' : 'reprovado'}">${resultado.acima_densidade}</td>
                <td>${resultado.pontos}/3</td>
                <td><span class="status ${resultado.status_class}">${resultado.status}</span></td>
            `;
            
            resultsBody.appendChild(tr);
        });
        
        // Configurar filtros
        setupFilters();
        
        // Scroll para resultados
        resultsCard.scrollIntoView({ behavior: 'smooth' });
    }
    
    function setupFilters() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        const tableRows = document.querySelectorAll('#resultsBody tr');
        
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Ativar botão clicado
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                const filter = button.getAttribute('data-filter');
                
                // Filtrar linhas
                tableRows.forEach(row => {
                    if (filter === 'all' || row.getAttribute('data-status') === filter) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            });
        });
    }
    
    function truncateText(text, maxLength) {
        if (typeof text !== 'string') return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
    
    function formatNumber(num) {
        if (typeof num !== 'number') return '0';
        return new Intl.NumberFormat('pt-BR').format(Math.round(num));
    }
    
    function showLoading(show) {
        loading.style.display = show ? 'block' : 'none';
    }
    
    function showMessage(message, type) {
        clearMessages();
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        messageContainer.appendChild(messageDiv);
        
        // Remover mensagem após 5 segundos
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.style.opacity = '0';
                setTimeout(() => {
                    if (messageDiv.parentNode) {
                        messageDiv.parentNode.removeChild(messageDiv);
                    }
                }, 300);
            }
        }, 5000);
    }
    
    function clearMessages() {
        messageContainer.innerHTML = '';
    }
    
    // Inicializar filtros
    if (document.querySelector('.filter-btn')) {
        setupFilters();
    }
});
