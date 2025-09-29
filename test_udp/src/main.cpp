#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

#include <chrono>
#include <cstdint>
#include <cstring>
#include <iostream>
#include <opencv2/opencv.hpp>
#include <string>
#include <thread>
#include <vector>

namespace {
constexpr uint8_t kProtocolVersion = 1;
constexpr size_t kHeaderSize = 23;
constexpr size_t kMaxUdpPayload = 1400;

struct PacketHeader {
  uint8_t version;
  uint8_t frame_type;
  uint8_t vehicle_id;
  uint32_t frame_id;
  uint16_t fragment_index;
  uint16_t total_fragments;
  uint64_t timestamp_ms;
  uint32_t data_length;
};

enum FrameType : uint8_t {
  kComplete = 0x01,
  kFragmentFirst = 0x02,
  kFragmentMiddle = 0x03,
  kFragmentLast = 0x04,
};

inline void WriteHeaderLE(const PacketHeader &header, std::vector<uint8_t> &buffer) {
  buffer.resize(kHeaderSize);
  size_t offset = 0;
  buffer[offset++] = header.version;
  buffer[offset++] = header.frame_type;
  buffer[offset++] = header.vehicle_id;

  auto write_u32 = [&](uint32_t value) {
    std::memcpy(buffer.data() + offset, &value, sizeof(value));
    offset += sizeof(value);
  };
  auto write_u16 = [&](uint16_t value) {
    std::memcpy(buffer.data() + offset, &value, sizeof(value));
    offset += sizeof(value);
  };
  auto write_u64 = [&](uint64_t value) {
    std::memcpy(buffer.data() + offset, &value, sizeof(value));
    offset += sizeof(value);
  };

  write_u32(header.frame_id);
  write_u16(header.fragment_index);
  write_u16(header.total_fragments);
  write_u64(header.timestamp_ms);
  write_u32(header.data_length);
}

uint64_t NowMillis() {
  using namespace std::chrono;
  return duration_cast<milliseconds>(steady_clock::now().time_since_epoch()).count();
}

bool SendPacket(int sockfd, const sockaddr_in &addr, const std::vector<uint8_t> &packet) {
  ssize_t sent = sendto(sockfd, packet.data(), packet.size(), 0,
                        reinterpret_cast<const sockaddr *>(&addr), sizeof(addr));
  return sent == static_cast<ssize_t>(packet.size());
}

bool SendCompleteFrame(int sockfd, const sockaddr_in &addr, uint8_t vehicle_id,
                       uint32_t frame_id, const std::vector<uint8_t> &jpeg) {
  PacketHeader header{
      kProtocolVersion,
      kComplete,
      vehicle_id,
      frame_id,
      0,
      1,
      NowMillis(),
      static_cast<uint32_t>(jpeg.size()),
  };
  std::vector<uint8_t> packet;
  WriteHeaderLE(header, packet);
  packet.insert(packet.end(), jpeg.begin(), jpeg.end());
  return SendPacket(sockfd, addr, packet);
}

bool SendFragmentedFrame(int sockfd, const sockaddr_in &addr, uint8_t vehicle_id,
                         uint32_t frame_id, const std::vector<uint8_t> &jpeg) {
  const size_t max_fragment = kMaxUdpPayload - kHeaderSize;
  const size_t total_fragments = (jpeg.size() + max_fragment - 1) / max_fragment;

  for (size_t i = 0; i < total_fragments; ++i) {
    size_t start = i * max_fragment;
    size_t end = std::min(start + max_fragment, jpeg.size());
    std::vector<uint8_t> fragment(jpeg.begin() + start, jpeg.begin() + end);

    FrameType type = kFragmentMiddle;
    if (i == 0) {
      type = kFragmentFirst;
    } else if (i == total_fragments - 1) {
      type = kFragmentLast;
    }

    PacketHeader header{
        kProtocolVersion,
        static_cast<uint8_t>(type),
        vehicle_id,
        frame_id,
        static_cast<uint16_t>(i),
        static_cast<uint16_t>(total_fragments),
        NowMillis(),
        static_cast<uint32_t>(fragment.size()),
    };

    std::vector<uint8_t> packet;
    WriteHeaderLE(header, packet);
    packet.insert(packet.end(), fragment.begin(), fragment.end());
    if (!SendPacket(sockfd, addr, packet)) {
      return false;
    }

    if (i + 1 != total_fragments) {
      std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }
  }
  return true;
}

}  // namespace

int main() {
  const uint8_t vehicle_id = 1;
  const std::string host = "127.0.0.1";
  const uint16_t port = 8080;
  const int camera_index = 0;
  const double fps = 30.0;
 
   cv::VideoCapture camera(camera_index);
  if (!camera.isOpened()) {
    std::cerr << "Failed to open camera " << camera_index << "\n";
    return 1;
  }
  camera.set(cv::CAP_PROP_FRAME_WIDTH, 640);
  camera.set(cv::CAP_PROP_FRAME_HEIGHT, 480);
  camera.set(cv::CAP_PROP_FPS, fps);

  int sockfd = socket(AF_INET, SOCK_DGRAM, 0);
  if (sockfd < 0) {
    std::cerr << "Unable to create UDP socket\n";
    return 1;
  }

  sockaddr_in addr{};
  addr.sin_family = AF_INET;
  addr.sin_port = htons(port);
  inet_pton(AF_INET, host.c_str(), &addr.sin_addr);

  uint32_t frame_counter = 0;
  const double frame_interval = 1.0 / fps;
  auto last_sent = std::chrono::steady_clock::now();

  std::cout << "UDP video sender started: vehicle=" << static_cast<int>(vehicle_id)
            << " target=" << host << ":" << port << " fps=" << fps << "\n";

  cv::Mat frame;
  std::vector<uint8_t> encoded;
  std::vector<int> encode_params = {cv::IMWRITE_JPEG_QUALITY, 70};

  while (true) {
    if (!camera.read(frame)) {
      std::cerr << "Failed to capture frame\n";
      break;
    }

    encoded.clear();
    if (!cv::imencode(".jpg", frame, encoded, encode_params)) {
      std::cerr << "JPEG encode failed\n";
      continue;
    }

    bool ok = false;
    if (encoded.size() + kHeaderSize <= kMaxUdpPayload) {
      ok = SendCompleteFrame(sockfd, addr, vehicle_id, frame_counter, encoded);
    } else {
      ok = SendFragmentedFrame(sockfd, addr, vehicle_id, frame_counter, encoded);
    }

    if (!ok) {
      std::cerr << "UDP send failed\n";
    }

    frame_counter++;
    auto now = std::chrono::steady_clock::now();
    auto elapsed = std::chrono::duration_cast<std::chrono::duration<double>>(now - last_sent).count();
    if (elapsed < frame_interval) {
      std::this_thread::sleep_for(std::chrono::duration<double>(frame_interval - elapsed));
    }
    last_sent = std::chrono::steady_clock::now();
  }

  close(sockfd);
  return 0;
}
