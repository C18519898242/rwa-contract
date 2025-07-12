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

- **所有权 (`Ownable`)**: 合约的所有者拥有特殊权限，例如调用快照、黑名单和冻结余额等功能。
- **小数位数**: 代币的小数位数被设置为 `6`。
- **快照 (`Snapshot`)**:
    - 这是此合约的关键功能。所有者可以调用 `snapshot()` 函数来创建一个当前所有代币持有者及其余额的“快照”。
    - `balanceOfAt(address, snapshotId)`: 允许查询在特定快照ID时，某个地址的代币余额。
    - `totalSupplyAt(snapshotId)`: 允许查询在特定快照ID时，代币的总供应量。
    - 这个快照机制是利息分配功能的基础。
- **黑名单 (`Blacklist`)**:
    - 合约所有者可以通过 `setBlacklisted(address, bool)` 函数将任何地址加入或移出黑名单。
    - 被列入黑名单的地址**不能发送或接收**代币。
    - `InterestDistribution` 合约也会检查此状态，禁止被列入黑名单的地址**领取利息**。
- **冻结余额 (`Frozen Balance`)**:
    - 合约所有者可以通过 `freezeBalance(address, amount)` 函数冻结指定地址的部分代币。
    - 被冻结的代币**不能被转账**。
    - `availableBalanceOf(address)` 函数可以查询一个地址的可用（未被冻结的）余额。
    - **重要**: 冻结余额**不影响**利息计算。利息是根据用户在快照时的**总余额**计算的，而不是可用余额。
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

### 使用 Web3.py (Python)

[Web3.py](https://web3py.readthedocs.io/) 是一个用于与以太坊交互的 Python 库。

**前置要求**:
- 安装 `web3`: `pip install web3`
- 编译合约以获取 ABI: `npx hardhat compile`

**示例代码 (`interact.py`)**:
```python
import json
from web3 import Web3

# --- 配置 ---
RPC_URL = 'YOUR_SEPOLIA_RPC_URL' # 或 'http://127.0.0.1:8545' 用于本地节点
PRIVATE_KEY = 'YOUR_PRIVATE_KEY'

with open('./test/sepolia-deployment.json', 'r') as f:
    deployment_info = json.load(f)
contract_address = deployment_info['interestDistribution']

with open('./artifacts/contracts/InterestDistribution.sol/InterestDistribution.json', 'r') as f:
    abi = json.load(f)['abi']

# --- 初始化 ---
w3 = Web3(Web3.HTTPProvider(RPC_URL))
account = w3.eth.account.from_key(PRIVATE_KEY)
contract = w3.eth.contract(address=contract_address, abi=abi)

def main():
    print(f"与合约 {contract_address} 交互...")
    print(f"使用账户: {account.address}")

    # 1. 调用只读方法
    snapshot_id = contract.functions.currentSnapshotId().call()
    print(f"当前快照 ID: {snapshot_id}")

    # 2. 调用交易方法
    try:
        print("尝试领取利息...")
        tx = contract.functions.claimInterest().build_transaction({
            'from': account.address,
            'nonce': w3.eth.get_transaction_count(account.address),
            'gas': 300000,
            'gasPrice': w3.eth.gas_price
        })
        signed_tx = w3.eth.account.sign_transaction(tx, private_key=PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        print(f"交易已发送, Hash: {w3.to_hex(tx_hash)}")
        
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        print("交易成功!", receipt)
    except Exception as e:
        print(f"交易失败: {e}")

if __name__ == '__main__':
    main()
```
**运行脚本**:
```bash
python interact.py
```

### 使用 Go

Go 语言通过 [go-ethereum](https://geth.ethereum.org/docs/developers/dapp-developer/native-dapps) 客户端库提供与以太坊的交互能力。

**前置要求**:
- 安装 Go 和 `go-ethereum` 库。
- 使用 `abigen` 工具从 ABI 生成 Go 包。

**1. 生成 Go 合约包装器**:
```bash
# 编译合约获取 ABI
npx hardhat compile

# 使用 abigen 生成 Go 文件
abigen --abi=artifacts/contracts/InterestDistribution.sol/InterestDistribution.json --pkg=main --out=interest.go
```

**2. Go 代码交互示例 (`main.go`)**:
```go
package main

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"log"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

func main() {
	// --- 配置 ---
	rpcURL := "YOUR_SEPOLIA_RPC_URL" // 或 "http://127.0.0.1:8545"
	privateKeyHex := "YOUR_PRIVATE_KEY"
	contractAddressHex := "YOUR_DEPLOYED_CONTRACT_ADDRESS"

	// --- 初始化 ---
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		log.Fatal(err)
	}

	privateKey, err := crypto.HexToECDSA(privateKeyHex)
	if err != nil {
		log.Fatal(err)
	}

	publicKey := privateKey.Public()
	publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		log.Fatal("error casting public key to ECDSA")
	}
	fromAddress := crypto.PubkeyToAddress(*publicKeyECDSA)

	contractAddress := common.HexToAddress(contractAddressHex)
	instance, err := NewMain(contractAddress, client) // NewMain 是 abigen 生成的函数
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("与合约交互...")
	fmt.Println("使用账户:", fromAddress.Hex())

	// 1. 调用只读方法
	snapshotId, err := instance.CurrentSnapshotId(nil)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("当前快照 ID:", snapshotId)

	// 2. 调用交易方法
	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, big.NewInt(11155111)) // 11155111 是 Sepolia 的 Chain ID
	if err != nil {
		log.Fatal(err)
	}
	auth.Nonce = nil // nil 表示自动获取
	auth.GasLimit = uint64(300000)

	fmt.Println("尝试领取利息...")
	tx, err := instance.ClaimInterest(auth)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("交易已发送, Hash: %s\n", tx.Hash().Hex())

	receipt, err := bind.WaitMined(context.Background(), client, tx)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("交易成功! 状态: %v\n", receipt.Status)
}
```
**运行脚本**:
```bash
go run main.go interest.go
```

### 使用 Web3.js (Node.js)

[Web3.js](https://web3js.org/) 是一个流行的 JavaScript 库，用于与以太坊区块链进行交互。

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
