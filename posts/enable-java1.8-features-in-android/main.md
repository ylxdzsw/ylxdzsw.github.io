## 在Android项目中使用java1.8的特性

Google在Android-N的SDK中支持了Java 1.8的部分特性，包括默认和静态接口方法、Lambda表达式(使用匿名类实现)以及重复注解等。

### 1. 安装Android Studio 2.1+

旧版本以及其它IDE都还暂时不支持Jack编译器，而这是启用Java 1.8特性所必需的，所以需要首先更新Android Studio到最新版本。

### 2. 设置build.gradle

```plain
android {
  ...
  compileSdkVersion 'android-N'
  buildToolsVersion '24 rc4'

  defaultConfig {
    ...
    jackOptions {
      enabled true
    }
  }
  compileOptions {
    sourceCompatibility JavaVersion.VERSION_1_8
    targetCompatibility JavaVersion.VERSION_1_8
  }
}
```

主要是3点: 启用Jack编译器, 设置Java版本以及设置sdk版本。

注意必须使用Android-N的sdk，但是`targetSdkVersion`和`minSdkVersion`可以低于Android-N，最小可以支持到API9(Gingerbread)。

### 3. 安装build-tools

这是最让人困扰的一步，怀疑可能是Android Studio的BUG。

在做完上述的步骤之后，Android Studio会提示需要安装Build Tool 24.0.0 rc4，但是点击安装又显示`not avaliable`。自己打开SDK Manager安装后，Android Studio仍然显示找不到

```
java.lang.IllegalStateException: failed to find Build Tools revision 24.0.0 rc4
```

经过查找之后，发现Android Studio始终是查找的`24.0.0-preview`文件夹，而SDK Manager安装的位置却是`24.0.0-rc4`，在网上搜索了一番，[最后在StackOverflow上找到了答案](http://stackoverflow.com/questions/27272605/failed-to-find-build-tools-revision-21-1-1-sdk-up-to-date)

> ```
> $android list sdk -a
> ```
> Which showed me the following list:
> ```
> 1- Android SDK Tools, revision 24.0.2
> 2- Android SDK Platform-tools, revision 21
> 3- Android SDK Build-tools, revision 21.1.2
> 4- Android SDK Build-tools, revision 21.1.1
> 5- Android SDK Build-tools, revision 21.1
> 6- Android SDK Build-tools, revision 21.0.2
> 7- Android SDK Build-tools, revision 21.0.1
> ```
> ... and a great many more
> Followed by the command:
> ```
> $ android update sdk -a -u -t 3
> ```
> The "3" in the command refers the the index listed in the output of the first command.

按照这个方法安装`Build-Tools 24 rc4`之后，`sdk/build-tools`中就出现了`24.0.0-preview`文件夹，再回到Android Studio已经没有报错了。






