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
- **防止重复领取**: 合约会记录每个地址是否已经领取过当前周期的利息，防止同一用户重复领取。

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

  *（这是一个占位符，您可以替换为实际的关系图链接）*
