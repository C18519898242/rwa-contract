# 合约说明文档

本文档详细介绍了本项目中的各个智能合约及其相互关系。

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

## 使用 Web3j 与合约交互

[Web3j](https://github.com/web3j/web3j) 是一个用于与以太坊区块链交互的轻量级、响应式的 Java 和 Android 库。

### 1. 生成合约的 Java 包装器

首先，您需要将 Solidity 合约编译后的 ABI 和 BIN 文件转换为 Java 代码。

- **编译合约**:
  ```bash
  npx hardhat compile
  ```
  这会在 `artifacts/contracts/` 目录下生成 ABI 和 BIN 文件。

- **使用 Web3j-CLI 生成包装器**:
  下载 [Web3j-CLI](https://docs.web3j.io/latest/command_line_tools/) 工具。然后为 `InterestDistribution.sol` 生成 Java 包装器：
  ```bash
  web3j generate solidity -a=artifacts/contracts/InterestDistribution.sol/InterestDistribution.json -o=src/main/java -p=com.yourpackage
  ```
  对其他需要交互的合约（如 `CSI300Token`, `MockUSDT`）重复此操作。

### 2. Java 代码交互示例

以下是一个使用生成的包装器与 `InterestDistribution` 合约交互的 Java 代码片段。

```java
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.http.HttpService;
import org.web3j.tx.gas.DefaultGasProvider;
import com.yourpackage.InterestDistribution; // 导入生成的包装器

public class BlockchainInteraction {

    public static void main(String[] args) throws Exception {
        // 1. 连接到节点
        Web3j web3j = Web3j.build(new HttpService("YOUR_SEPOLIA_RPC_URL"));

        // 2. 加载你的账户凭证
        String privateKey = "YOUR_PRIVATE_KEY";
        Credentials credentials = Credentials.create(privateKey);

        // 3. 加载已部署的合约
        String contractAddress = "DEPLOYED_INTEREST_DISTRIBUTION_ADDRESS"; // 从 sepolia-deployment.json 获取
        InterestDistribution contract = InterestDistribution.load(
            contractAddress,
            web3j,
            credentials,
            new DefaultGasProvider()
        );

        // 4. 调用合约的只读方法 (View/Pure)
        System.out.println("Fetching current snapshot ID...");
        BigInteger currentSnapshotId = contract.currentSnapshotId().send();
        System.out.println("Current Snapshot ID: " + currentSnapshotId);

        // 5. 调用合约的交易方法 (Transaction)
        System.out.println("Claiming interest...");
        TransactionReceipt receipt = contract.claimInterest().send();
        System.out.println("Transaction successful, hash: " + receipt.getTransactionHash());
    }
}
```

**注意事项**:
- 将 `YOUR_SEPOLIA_RPC_URL`, `YOUR_PRIVATE_KEY`, 和 `DEPLOYED_INTEREST_DISTRIBUTION_ADDRESS` 替换为您的实际值。
- 确保您的 Java 项目中已经添加了 Web3j 的依赖（例如，通过 Maven 或 Gradle）。
- 调用交易方法（如 `claimInterest`）会消耗 Gas，请确保您的账户中有足够的测试 ETH。
