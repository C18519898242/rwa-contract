# RWA 合约项目

本文档详细介绍了本项目中的各个智能合约、如何部署、测试以及如何通过客户端库与之交互。

## 合约列表

- `CSI300Token.sol`: 沪深300指数代币合约。
- `InterestDistribution.sol`: 利息分发合约。
- `MockUSDT.sol`: 模拟的USDT代币合约。
- `MockOracle.sol`: 模拟的预言机合约。

---

### 1. `CSI300Token.sol`

这是一个符合ERC20标准的代币合约，代表“沪深300指数代币”。除了标准的ERC20功能外，它还包含了以下核心特性：

- **所有权 (`Ownable`)**: 合约的所有者拥有特殊权限，例如调用快照功能。
- **快照 (`Snapshot`)**:
    - 这是此合约的关键功能。所有者可以调用 `snapshot()` 函数来创建一个当前所有代币持有者及其余额的“快照”。
    - `balanceOfAt(address, snapshotId)`: 允许查询在特定快照ID时，某个地址的代币余额。
    - `totalSupplyAt(snapshotId)`: 允许查询在特定快照ID时，代币的总供应量。
    - 这个快照机制是利息分配功能的基础。
- **预言机集成**: 合约可以连接到一个预言机（Oracle）地址，用于获取价格数据，尽管此功能目前未在利息分配逻辑中使用。

### 2. `InterestDistribution.sol`

该合约负责根据用户持有的 `CSI300Token` 数量，向他们分发 `MockUSDT` 作为利息。

- **核心流程**:
    1.  **设置总利息**: 合约所有者（管理员）调用 `setTotalInterest(amount)` 函数，并存入指定数量的 `MockUSDT` 作为本期分红的总利息池。
    2.  **创建快照**: 在 `setTotalInterest` 函数内部，会自动调用 `CSI300Token` 合约的 `snapshot()` 函数，记录当前时刻所有 `CSI300Token` 持有者的余额。
    3.  **用户领取利息**: 用户可以调用 `claimInterest()` 函数。合约会根据该用户在快照时的 `CSI300Token` 持有量，按比例计算其应得的 `MockUSDT` 利息，并将其发送给用户。
- **防止重复领取**: 合约会记录每个地址在每个利息周期（由 `snapshotId` 标识）是否已经领取过利息，防止同一用户在同一周期重复领取。

### 3. `MockUSDT.sol`

一个标准的、用于测试目的的ERC20代币合约。它模拟了USDT的功能，主要用于在 `InterestDistribution` 合约中作为利息进行分发。它有一个 `mint` 函数，允许任何人铸造任意数量的代币以方便测试。

### 4. `MockOracle.sol`

一个简单的模拟预言机合约，它总是返回一个固定的价格。它被 `CSI300Token` 合约用来模拟从外部获取价格数据的过程。

## 合约间关系

这些合约共同构成了一个完整的利息分发系统：

1.  `InterestDistribution` 是核心业务逻辑合约。它需要与 `CSI300Token` 和 `MockUSDT` 进行交互。
2.  为了让 `InterestDistribution` 能够成功调用 `CSI300Token` 的 `snapshot()` 函数（这是一个仅限所有者的函数），在部署时，`CSI300Token` 合约的所有权被转移给了 `InterestDistribution` 合约。
3.  `CSI300Token` 在部署时需要一个预言机地址，因此它依赖于 `MockOracle` 合约。
4.  用户持有 `CSI300Token`，并通过与 `InterestDistribution` 合约交互来领取 `MockUSDT` 利息。

---

## 部署指南

### 1. 本地网络部署

用于快速测试和开发。

- **启动本地节点**:
  ```bash
  npx hardhat node
  ```
- **执行部署脚本**:
  在一个新的终端窗口中，运行以下命令：
  ```bash
  npx hardhat run scripts/deploy-interest.ts --network localhost
  ```
  部署成功后，合约地址将显示在终端中。

### 2. Sepolia 测试网部署

用于在公共测试网上进行验证。

- **配置环境变量**:
  1.  复制 `.env.example` 文件并重命名为 `.env`。
  2.  在 `.env` 文件中填入您的 `SEPOLIA_RPC_URL` (例如，从 Infura 或 Alchemy 获取) 和您的账户 `PRIVATE_KEY`。
      ```
      SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID"
      PRIVATE_KEY="YOUR_ACCOUNT_PRIVATE_KEY"
      ```
- **执行部署脚本**:
  ```bash
  npx hardhat run scripts/deploy-interest.ts --network sepolia
  ```
- **查看部署信息**:
  部署成功后，所有合约的地址会自动保存到 `test/sepolia-deployment.json` 文件中。

---

## 测试指南

### 1. 标准本地测试

这是最快捷的测试方式，它会使用 Hardhat 内置的、临时的测试环境。

```bash
npx hardhat test
```
此命令会自动编译合约并运行 `test/` 目录下的所有测试脚本。

### 2. 连接到本地节点进行测试

这种方式可以模拟更真实的网络交互，允许您在测试运行期间观察节点日志。

- **第一步：启动本地节点**
  在终端中运行：
  ```bash
  npx hardhat node
  ```
  此命令会启动一个本地的以太坊节点，并列出一些可用的测试账户。

- **第二步：运行测试**
  在**另一个**新的终端窗口中，运行以下命令，将测试指向您刚刚启动的本地节点：
  ```bash
  npx hardhat test --network localhost
  ```
  您也可以指定单个测试文件：
  ```bash
  npx hardhat test test/InterestDistribution.ts --network localhost
  ```

---

## 客户端交互示例

### 使用 Web3.js

[Web3.js](https://web3js.org/) 是一个流行的 JavaScript 库，用于与以太坊区块链进行交互。

#### 1. Node.js 环境

**前置要求**:
- 安装 `web3`: `npm install web3`
- 编译合约以获取 ABI: `npx hardhat compile`

**示例代码 (`interact.js`)**:
```javascript
const { Web3 } = require('web3');
const fs = require('fs');

// --- 配置 ---
const RPC_URL = 'YOUR_SEPOLIA_RPC_URL'; // 或 'http://127.0.0.1:8545' 用于本地节点
const PRIVATE_KEY = 'YOUR_PRIVATE_KEY'; 
const deploymentInfo = require('./test/sepolia-deployment.json');
const contractAddress = deploymentInfo.interestDistribution;

// 加载 ABI
const abi = JSON.parse(fs.readFileSync('./artifacts/contracts/InterestDistribution.sol/InterestDistribution.json', 'utf8')).abi;

// --- 初始化 ---
const web3 = new Web3(RPC_URL);
const account = web3.eth.accounts.privateKeyToAccount('0x' + PRIVATE_KEY);
web3.eth.accounts.wallet.add(account);
const contract = new web3.eth.Contract(abi, contractAddress);

async function main() {
    console.log(`与合约 ${contractAddress} 交互...`);
    console.log(`使用账户: ${account.address}`);

    // 1. 调用只读方法
    const snapshotId = await contract.methods.currentSnapshotId().call();
    console.log('当前快照 ID:', snapshotId.toString());

    // 2. 调用交易方法
    try {
        console.log('尝试领取利息...');
        const tx = await contract.methods.claimInterest().send({
            from: account.address,
            gas: 300000 // 预估 Gas Limit
        });
        console.log('交易成功, Hash:', tx.transactionHash);
    } catch (error) {
        console.error('交易失败:', error.message);
    }
}

main();
```
**运行脚本**:
```bash
node interact.js
```

#### 2. 浏览器环境 (Web)

**前置要求**:
- 用户浏览器安装了像 MetaMask 这样的钱包插件。
- 在 HTML 文件中引入 Web3.js (例如通过 CDN)。

**示例代码 (`index.html`)**:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Web3.js 交互示例</title>
    <script src="https://cdn.jsdelivr.net/npm/web3@latest/dist/web3.min.js"></script>
</head>
<body>
    <h1>合约交互</h1>
    <button id="connectButton">连接钱包</button>
    <button id="claimButton" disabled>领取利息</button>
    <p>状态: <span id="status">未连接</span></p>
    <p>当前快照 ID: <span id="snapshotId">N/A</span></p>

    <script>
        const contractAddress = "YOUR_DEPLOYED_CONTRACT_ADDRESS"; // 从 sepolia-deployment.json 获取
        const abi = [/* 在这里粘贴 InterestDistribution.json 中的 ABI 数组 */];

        let web3;
        let contract;
        let userAccount;

        const connectButton = document.getElementById('connectButton');
        const claimButton = document.getElementById('claimButton');
        const statusEl = document.getElementById('status');
        const snapshotIdEl = document.getElementById('snapshotId');

        connectButton.onclick = async () => {
            if (typeof window.ethereum !== 'undefined') {
                try {
                    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                    userAccount = accounts[0];
                    web3 = new Web3(window.ethereum);
                    contract = new web3.eth.Contract(abi, contractAddress);
                    
                    statusEl.textContent = `已连接: ${userAccount.substring(0, 6)}...`;
                    connectButton.disabled = true;
                    claimButton.disabled = false;

                    // 获取并显示快照ID
                    const snapshotId = await contract.methods.currentSnapshotId().call();
                    snapshotIdEl.textContent = snapshotId.toString();

                } catch (error) {
                    statusEl.textContent = "连接失败: " + error.message;
                }
            } else {
                statusEl.textContent = "请安装 MetaMask!";
            }
        };

        claimButton.onclick = async () => {
            if (!contract || !userAccount) return;
            statusEl.textContent = "正在发送交易...";
            try {
                const tx = await contract.methods.claimInterest().send({ from: userAccount });
                statusEl.textContent = `交易成功! Hash: ${tx.transactionHash}`;
            } catch (error) {
                statusEl.textContent = "交易失败: " + error.message;
            }
        };
    </script>
</body>
</html>
```

### 使用 Web3j (Java)

[Web3j](https://github.com/web3j/web3j) 是一个用于与以太坊区块链交互的轻量级、响应式的 Java 和 Android 库。

#### 1. 生成合约的 Java 包装器

- **编译合约**:
  ```bash
  npx hardhat compile
  ```
- **使用 Web3j-CLI 生成包装器**:
  下载 [Web3j-CLI](https://docs.web3j.io/latest/command_line_tools/) 工具。然后为 `InterestDistribution.sol` 生成 Java 包装器：
  ```bash
  web3j generate solidity -a=artifacts/contracts/InterestDistribution.sol/InterestDistribution.json -o=src/main/java -p=com.yourpackage
  ```

#### 2. Java 代码交互示例

```java
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.http.HttpService;
import org.web3j.tx.gas.DefaultGasProvider;
import com.yourpackage.InterestDistribution; // 导入生成的包装器

public class BlockchainInteraction {

    public static void main(String[] args) throws Exception {
        Web3j web3j = Web3j.build(new HttpService("YOUR_SEPOLIA_RPC_URL"));
        Credentials credentials = Credentials.create("YOUR_PRIVATE_KEY");
        InterestDistribution contract = InterestDistribution.load(
            "DEPLOYED_INTEREST_DISTRIBUTION_ADDRESS",
            web3j,
            credentials,
            new DefaultGasProvider()
        );

        System.out.println("Fetching current snapshot ID...");
        BigInteger currentSnapshotId = contract.currentSnapshotId().send();
        System.out.println("Current Snapshot ID: " + currentSnapshotId);

        System.out.println("Claiming interest...");
        TransactionReceipt receipt = contract.claimInterest().send();
        System.out.println("Transaction successful, hash: " + receipt.getTransactionHash());
    }
}
